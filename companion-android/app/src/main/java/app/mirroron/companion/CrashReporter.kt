package app.mirroron.companion

import android.content.Context
import android.os.Build
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * 개발용 크래시/오류 리포터.
 * 앱이 죽으면 스택을 SharedPreferences에 저장했다가 다음 실행 때 개발서버(/api/app-crash)로 전송.
 * 잡힌 예외는 report()로 즉시 전송. (프로덕션에서는 제거하거나 opt-in으로 전환할 것)
 */
object CrashReporter {

    private val http: OkHttpClient by lazy {
        val trustAll = object : X509TrustManager {
            override fun checkClientTrusted(c: Array<X509Certificate>, a: String) {}
            override fun checkServerTrusted(c: Array<X509Certificate>, a: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
        val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trustAll), SecureRandom()) }
        OkHttpClient.Builder()
            .sslSocketFactory(ssl.socketFactory, trustAll)
            .hostnameVerifier { _, _ -> true }
            .connectTimeout(3, TimeUnit.SECONDS)
            .build()
    }

    fun install(context: Context) {
        val appContext = context.applicationContext
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            try {
                val text = "[${thread.name}] ${Log.getStackTraceString(e)}"
                appContext.getSharedPreferences("mirroron", Context.MODE_PRIVATE)
                    .edit()
                    .putString("pending_crash", text) // 서버 전송용
                    .putString("last_crash_shown", text) // 다음 실행 시 화면 표시용
                    .commit() // 프로세스가 곧 죽으므로 동기 저장
            } catch (_: Exception) {
            }
            prev?.uncaughtException(thread, e)
        }
    }

    /** 앱 시작 시: 지난번 크래시가 저장돼 있으면 전송 */
    fun flushPending(context: Context) {
        val prefs = context.getSharedPreferences("mirroron", Context.MODE_PRIVATE)
        val stack = prefs.getString("pending_crash", null) ?: return
        prefs.edit().remove("pending_crash").apply()
        send(context, "uncaught", stack)
    }

    /** 잡힌 예외 즉시 전송 */
    fun report(context: Context, tag: String, e: Throwable) {
        send(context, tag, Log.getStackTraceString(e))
    }

    private fun send(context: Context, tag: String, stack: String) {
        val host = context.getSharedPreferences("mirroron", Context.MODE_PRIVATE)
            .getString("host", null) ?: return
        var h = host.trim().removePrefix("https://").removePrefix("http://").trimEnd('/')
        if (!h.contains(":")) h += ":3000"

        Thread {
            try {
                val body = JSONObject()
                    .put("tag", tag)
                    .put("stack", stack)
                    .put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
                    .put("sdk", Build.VERSION.SDK_INT)
                http.newCall(
                    Request.Builder()
                        .url("https://$h/api/app-crash")
                        .post(body.toString().toRequestBody("application/json".toMediaType()))
                        .build(),
                ).execute().close()
            } catch (_: Exception) {
            }
        }.start()
    }
}
