package app.mirroron.companion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import org.json.JSONObject
import kotlin.coroutines.resume

/**
 * 화면 송출 포그라운드 서비스 (mediaProjection 타입).
 * MainActivity가 MediaProjection 승인 결과와 코드/호스트를 넘기면
 * 룸 검증 → TURN → 시그널링 → WebRTC 송출을 담당한다.
 */
class ScreenCastService : Service() {

    private var signaling: SignalingClient? = null
    private var firebaseSig: FirebaseSignaling? = null
    private var webrtc: WebRtcClient? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelfClean()
            return START_NOT_STICKY
        }

        val projectionData = intent?.getParcelableExtra<Intent>(EXTRA_PROJECTION)
        val code = intent?.getStringExtra(EXTRA_CODE)
        val host = intent?.getStringExtra(EXTRA_HOST)
        if (projectionData == null || code == null || host == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundWithNotification()

        // 호스트 정규화: 프로토콜/슬래시 제거.
        // 로컬 IP(192.168.x 등)는 개발서버라 포트 없으면 :3000, 도메인은 그대로(443).
        var h = host.trim().removePrefix("https://").removePrefix("http://").trimEnd('/')
        val looksLikeIp = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$").matches(h) || h == "localhost"
        if (looksLikeIp && !h.contains(":")) h += ":3000"
        val base = "https://$h"
        val peerId = "app-" + System.currentTimeMillis().toString(36)

        // HTTP 헬퍼용 (config·turn 조회, 로컬 데브 폴백 시그널링)
        val sig = SignalingClient(
            baseUrl = base,
            channel = "room:$code",
            onMessage = { msg -> webrtc?.handleSignal(msg) },
            onError = { _state.value = "failed" },
        )
        signaling = sig

        scope.launch {
            try {
                _state.value = "joining"

                // 1) 배포 서버의 Firebase 설정 조회
                val config = try { sig.getJson("/api/config") } catch (_: Exception) { JSONObject() }
                val useFirebase = config.optBoolean("hasFirebase", false)

                // 2) 시그널 전송 람다 준비 (Firebase 또는 폴링)
                val sendSignal: (JSONObject) -> Unit
                if (useFirebase) {
                    val db: FirebaseDatabase =
                        FirebaseSignaling.initDatabase(applicationContext, config.getJSONObject("firebase"))

                    // 룸 검증 (RTDB read)
                    val meta = awaitSnapshot(db, "rooms/$code/meta")
                    if (!FirebaseSignaling.roomExists(meta)) {
                        _state.value = if (meta.exists()) "expired" else "wrong_code"
                        stopSelfClean()
                        return@launch
                    }

                    val fb = FirebaseSignaling(db, "room:$code") { msg -> webrtc?.handleSignal(msg) }
                    firebaseSig = fb
                    fb.start()
                    sendSignal = { msg -> fb.send(msg) }
                } else {
                    // 로컬 데브: 서버 API + HTTP 폴링
                    val join = sig.postJson(
                        "/api/rooms/join",
                        JSONObject().put("code", code).put("entryMethod", "deeplink"),
                    )
                    if (join.optInt("_status") !in 200..299) {
                        _state.value = if (join.optString("error") == "room_expired") "expired" else "wrong_code"
                        stopSelfClean()
                        return@launch
                    }
                    sig.start()
                    sendSignal = { msg -> sig.send(msg) }
                }

                // 3) TURN 자격증명 (공개 릴레이 포함)
                val ice = WebRtcClient.parseIceServers(sig.getJson("/api/turn-credentials"))

                // 4) WebRTC/MediaProjection 초기화는 메인 스레드(Looper 보유)에서
                val metrics: DisplayMetrics = resources.displayMetrics
                withContext(Dispatchers.Main) {
                    val client = WebRtcClient(this@ScreenCastService, sendSignal, peerId) { s ->
                        _state.value = s
                        if (s == "ended") stopSelfClean()
                    }
                    webrtc = client
                    client.start(projectionData, ice, metrics)
                }
            } catch (e: Exception) {
                CrashReporter.report(this@ScreenCastService, "service-start", e)
                _state.value = "unreachable"
                stopSelfClean()
            }
        }
        return START_NOT_STICKY
    }

    /** RTDB 단일 값 읽기 (suspend) */
    private suspend fun awaitSnapshot(db: FirebaseDatabase, path: String): DataSnapshot =
        suspendCancellableCoroutine { cont ->
            db.getReference(path).addListenerForSingleValueEvent(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (cont.isActive) cont.resume(snapshot)
                }
                override fun onCancelled(error: DatabaseError) {
                    if (cont.isActive) cont.resumeWith(Result.failure(error.toException()))
                }
            })
        }

    private fun startForegroundWithNotification() {
        val channelId = "mirroron-cast"
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(channelId, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW),
            )
        }
        val notification: Notification = Notification.Builder(this, channelId)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notif_casting))
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun stopSelfClean() {
        runCatching { webrtc?.close() }
        webrtc = null
        runCatching { firebaseSig?.close() }
        firebaseSig = null
        signaling?.close()
        signaling = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        if (_state.value !in listOf("failed", "expired", "wrong_code", "unreachable")) _state.value = "idle"
    }

    override fun onDestroy() {
        runCatching { webrtc?.close() }
        runCatching { firebaseSig?.close() }
        signaling?.close()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_PROJECTION = "projection"
        const val EXTRA_CODE = "code"
        const val EXTRA_HOST = "host"
        const val ACTION_STOP = "app.mirroron.companion.STOP"
        private const val NOTIF_ID = 1001

        private val _state = MutableStateFlow("idle")
        val state: StateFlow<String> = _state
    }
}
