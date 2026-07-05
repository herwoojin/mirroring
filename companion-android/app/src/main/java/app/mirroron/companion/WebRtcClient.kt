package app.mirroron.companion

import android.content.Context
import android.content.Intent
import android.util.DisplayMetrics
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.SoftwareVideoDecoderFactory
import org.webrtc.SoftwareVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

/**
 * 폰 화면(MediaProjection) → WebRTC 송출.
 * 미러온 시그널링 프로토콜: 앱이 offer 주도(impolite), 뷰어(PC 웹)가 answer.
 */
class WebRtcClient(
    private val context: Context,
    private val sendSignal: (JSONObject) -> Unit, // 시그널 전송 (Firebase 또는 폴링)
    private val peerId: String,
    private val onState: (String) -> Unit,
) {
    private val eglBase: EglBase = EglBase.create()
    private lateinit var factory: PeerConnectionFactory
    private var pc: PeerConnection? = null
    private var capturer: ScreenCapturerAndroid? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var remotePeerId: String? = null
    private val pendingCandidates = mutableListOf<IceCandidate>()
    private var remoteSet = false

    fun start(projectionData: Intent, iceServers: List<PeerConnection.IceServer>, metrics: DisplayMetrics) {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions(),
        )
        // 소프트웨어 인코더 사용: 삼성 등 일부 기기의 하드웨어 인코더가
        // 화면 캡처 시작 직후 네이티브(C++)에서 죽는 문제를 회피 (CPU는 더 쓰지만 안정적)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(SoftwareVideoEncoderFactory())
            .setVideoDecoderFactory(SoftwareVideoDecoderFactory())
            .createPeerConnectionFactory()

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            iceCandidatePoolSize = 4
        }

        pc = factory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(c: IceCandidate) {
                sendSignal(
                    JSONObject()
                        .put("type", "ice")
                        .put("from", peerId)
                        .apply { remotePeerId?.let { put("to", it) } }
                        .put(
                            "payload",
                            JSONObject().put(
                                "candidate",
                                JSONObject()
                                    .put("candidate", c.sdp)
                                    .put("sdpMid", c.sdpMid)
                                    .put("sdpMLineIndex", c.sdpMLineIndex),
                            ),
                        ),
                )
            }

            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
                when (state) {
                    PeerConnection.PeerConnectionState.CONNECTED -> onState("connected")
                    PeerConnection.PeerConnectionState.DISCONNECTED -> onState("reconnecting")
                    PeerConnection.PeerConnectionState.FAILED -> onState("failed")
                    else -> {}
                }
            }

            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState) {}
            override fun onIceConnectionReceivingChange(r: Boolean) {}
            override fun onIceGatheringChange(s: PeerConnection.IceGatheringState) {}
            override fun onSignalingChange(s: PeerConnection.SignalingState) {}
            override fun onIceCandidatesRemoved(c: Array<out IceCandidate>) {}
            override fun onAddStream(s: org.webrtc.MediaStream) {}
            override fun onRemoveStream(s: org.webrtc.MediaStream) {}
            override fun onDataChannel(d: org.webrtc.DataChannel) {}
            override fun onRenegotiationNeeded() {}
        }) ?: throw IllegalStateException("PeerConnection 생성 실패")

        // 화면 캡처 (MediaProjection)
        capturer = ScreenCapturerAndroid(projectionData, object : android.media.projection.MediaProjection.Callback() {
            override fun onStop() {
                onState("ended")
            }
        })
        videoSource = factory.createVideoSource(true) // isScreencast
        val helper = SurfaceTextureHelper.create("screen-capture", eglBase.eglBaseContext)
        capturer!!.initialize(helper, context, videoSource!!.capturerObserver)

        // 세로 화면 기준 최대 1280px로 캡처 (인코딩 부하·지연 균형)
        // 가로/세로를 16의 배수로 정렬 — 일부 기기(삼성 Exynos 등) HW 인코더는
        // 비정렬 해상도에서 네이티브 크래시가 발생함
        val scale = if (metrics.heightPixels > 1280) 1280.0 / metrics.heightPixels else 1.0
        val w = ((metrics.widthPixels * scale).toInt() / 16) * 16
        val h = ((metrics.heightPixels * scale).toInt() / 16) * 16
        capturer!!.startCapture(w.coerceAtLeast(240), h.coerceAtLeast(240), 30)

        videoTrack = factory.createVideoTrack("mirroron-screen", videoSource)
        pc!!.addTrack(videoTrack, listOf("mirroron-stream"))

        // join 알림 후 offer 전송 (미디어 보유측이 주도)
        sendSignal(
            JSONObject()
                .put("type", "join")
                .put("from", peerId)
                .put("payload", JSONObject().put("role", "sender").put("device", JSONObject().put("os", "android-app"))),
        )
        createAndSendOffer()
        onState("connecting")
    }

    fun handleSignal(msg: JSONObject) {
        val type = msg.optString("type")
        val from = msg.optString("from")
        val to = msg.optString("to", "")
        if (from == peerId) return
        if (to.isNotEmpty() && to != peerId) return

        when (type) {
            "answer" -> {
                remotePeerId = from
                val sdp = msg.getJSONObject("payload").getString("sdp")
                pc?.setRemoteDescription(
                    sdpObserver {
                        remoteSet = true
                        pendingCandidates.forEach { pc?.addIceCandidate(it) }
                        pendingCandidates.clear()
                    },
                    SessionDescription(SessionDescription.Type.ANSWER, sdp),
                )
            }
            "ice" -> {
                val c = msg.getJSONObject("payload").getJSONObject("candidate")
                val candidate = IceCandidate(
                    c.optString("sdpMid"),
                    c.optInt("sdpMLineIndex", 0),
                    c.optString("candidate"),
                )
                if (remoteSet) pc?.addIceCandidate(candidate) else pendingCandidates.add(candidate)
            }
            "join" -> {
                // 뷰어 재입장 → 재offer
                if (remotePeerId == null) remotePeerId = from
                createAndSendOffer()
            }
            "leave" -> if (from == remotePeerId) onState("ended")
        }
    }

    private fun createAndSendOffer() {
        val pc = pc ?: return
        pc.createOffer(
            object : SdpObserver {
                override fun onCreateSuccess(desc: SessionDescription) {
                    pc.setLocalDescription(sdpObserver {
                        sendSignal(
                            JSONObject()
                                .put("type", "offer")
                                .put("from", peerId)
                                .apply { remotePeerId?.let { put("to", it) } }
                                .put("payload", JSONObject().put("sdp", desc.description)),
                        )
                    }, desc)
                }

                override fun onCreateFailure(e: String?) { onState("failed") }
                override fun onSetSuccess() {}
                override fun onSetFailure(e: String?) {}
            },
            MediaConstraints(),
        )
    }

    private fun sdpObserver(onSet: () -> Unit) = object : SdpObserver {
        override fun onSetSuccess() = onSet()
        override fun onSetFailure(e: String?) { onState("failed") }
        override fun onCreateSuccess(d: SessionDescription?) {}
        override fun onCreateFailure(e: String?) {}
    }

    fun close() {
        sendSignal(JSONObject().put("type", "leave").put("from", peerId).put("payload", JSONObject()))
        runCatching { capturer?.stopCapture() }
        capturer?.dispose()
        videoTrack?.dispose()
        videoSource?.dispose()
        pc?.close()
        eglBase.release()
    }

    companion object {
        /** /api/turn-credentials 응답 → IceServer 목록 */
        fun parseIceServers(json: JSONObject): List<PeerConnection.IceServer> {
            val out = mutableListOf<PeerConnection.IceServer>()
            val arr: JSONArray = json.optJSONArray("iceServers") ?: JSONArray()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                val urls = mutableListOf<String>()
                when (val u = s.get("urls")) {
                    is JSONArray -> for (j in 0 until u.length()) urls.add(u.getString(j))
                    else -> urls.add(u.toString())
                }
                val builder = PeerConnection.IceServer.builder(urls)
                if (s.has("username")) builder.setUsername(s.getString("username"))
                if (s.has("credential")) builder.setPassword(s.getString("credential"))
                out.add(builder.createIceServer())
            }
            if (out.isEmpty()) {
                out.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
            }
            return out
        }
    }
}
