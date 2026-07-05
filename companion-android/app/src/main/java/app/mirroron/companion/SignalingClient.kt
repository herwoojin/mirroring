package app.mirroron.companion

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * 미러온 웹 데브 시그널링(/api/dev-signaling 폴링)과 동일한 프로토콜을 말하는 클라이언트.
 * - sid 필터로 자기 메시지를 받지 않음
 * - init 폴링으로 구독 시점 이후 메시지만 수신
 * - 도착 순서대로 순차 콜백
 *
 * ⚠️ 개발서버는 자체 서명 인증서(HTTPS)라 개발 빌드에서는 TLS 검증을 생략한다.
 *    프로덕션(정식 인증서)에서는 기본 OkHttpClient로 교체할 것.
 */
class SignalingClient(
    baseUrl: String, // 예: https://192.168.0.10:3000
    private val channel: String, // room:{code}
    private val onMessage: (JSONObject) -> Unit,
    private val onError: (String) -> Unit,
) {
    private val base = baseUrl.trimEnd('/')
    private val sid = List(10) { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = "application/json; charset=utf-8".toMediaType()
    private var since = -1L

    val http: OkHttpClient = buildTrustAllClient()

    private fun buildTrustAllClient(): OkHttpClient {
        val trustAll = object : X509TrustManager {
            override fun checkClientTrusted(c: Array<X509Certificate>, a: String) {}
            override fun checkServerTrusted(c: Array<X509Certificate>, a: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
        val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trustAll), SecureRandom()) }
        return OkHttpClient.Builder()
            .sslSocketFactory(ssl.socketFactory, trustAll)
            .hostnameVerifier { _, _ -> true }
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    fun start() {
        scope.launch {
            var failures = 0
            while (true) {
                try {
                    if (since < 0) {
                        val res = get("$base/api/dev-signaling?channel=$channel&sid=$sid&init=1")
                        since = res.optLong("newIdx", 0)
                    } else {
                        val res = get("$base/api/dev-signaling?channel=$channel&sid=$sid&since=$since")
                        since = res.optLong("newIdx", since)
                        val msgs: JSONArray = res.optJSONArray("messages") ?: JSONArray()
                        for (i in 0 until msgs.length()) {
                            onMessage(msgs.getJSONObject(i))
                        }
                    }
                    failures = 0
                } catch (e: Exception) {
                    if (++failures > 15) {
                        onError("signaling_lost")
                        return@launch
                    }
                }
                delay(400)
            }
        }
    }

    fun send(msg: JSONObject) {
        scope.launch {
            try {
                val body = JSONObject()
                    .put("channel", channel)
                    .put("sid", sid)
                    .put("msg", msg)
                http.newCall(
                    Request.Builder()
                        .url("$base/api/dev-signaling")
                        .post(body.toString().toRequestBody(json))
                        .build(),
                ).execute().close()
            } catch (_: Exception) {
            }
        }
    }

    /** POST 유틸 (rooms/join 등) */
    fun postJson(path: String, payload: JSONObject): JSONObject {
        http.newCall(
            Request.Builder().url("$base$path").post(payload.toString().toRequestBody(json)).build(),
        ).execute().use { res ->
            val text = res.body?.string() ?: "{}"
            val obj = try { JSONObject(text) } catch (_: Exception) { JSONObject() }
            obj.put("_status", res.code)
            return obj
        }
    }

    fun getJson(path: String): JSONObject = get("$base$path")

    private fun get(url: String): JSONObject {
        http.newCall(Request.Builder().url(url).get().build()).execute().use { res ->
            if (!res.isSuccessful) throw RuntimeException("HTTP ${res.code}")
            return JSONObject(res.body?.string() ?: "{}")
        }
    }

    fun close() {
        scope.cancel()
    }
}
