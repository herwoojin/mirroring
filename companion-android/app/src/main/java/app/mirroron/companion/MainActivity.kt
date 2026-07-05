package app.mirroron.companion

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var codeInput: EditText
    private lateinit var hostInput: EditText
    private lateinit var statusText: TextView
    private lateinit var startBtn: Button
    private lateinit var stopBtn: Button

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            val intent = Intent(this, ScreenCastService::class.java)
                .putExtra(ScreenCastService.EXTRA_PROJECTION, data)
                .putExtra(ScreenCastService.EXTRA_CODE, codeInput.text.toString().trim())
                .putExtra(ScreenCastService.EXTRA_HOST, hostInput.text.toString().trim())
            startForegroundService(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CrashReporter.install(this)
        CrashReporter.flushPending(this) // 지난번 크래시가 있으면 개발서버로 전송
        setContentView(R.layout.activity_main)

        // 지난번 크래시 스택을 화면에 직접 표시 (adb 없이 원인 확보용)
        val prefs0 = getSharedPreferences("mirroron", Context.MODE_PRIVATE)
        prefs0.getString("last_crash_shown", null)?.let { stack ->
            prefs0.edit().remove("last_crash_shown").apply()
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("지난 오류 내용 (개발용)")
                .setMessage(stack.take(3000))
                .setPositiveButton("복사") { _, _ ->
                    val cm = getSystemService(android.content.ClipboardManager::class.java)
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("crash", stack))
                }
                .setNegativeButton("닫기", null)
                .show()
        }

        codeInput = findViewById(R.id.codeInput)
        hostInput = findViewById(R.id.hostInput)
        statusText = findViewById(R.id.statusText)
        startBtn = findViewById(R.id.startBtn)
        stopBtn = findViewById(R.id.stopBtn)

        // 마지막 사용 호스트 복원
        val prefs = getSharedPreferences("mirroron", Context.MODE_PRIVATE)
        hostInput.setText(prefs.getString("host", "") ?: "")

        handleDeepLink(intent)

        startBtn.setOnClickListener {
            val code = codeInput.text.toString().trim()
            val host = hostInput.text.toString().trim()
            if (code.length != 6 || host.isEmpty()) {
                statusText.text = getString(R.string.subtitle)
                return@setOnClickListener
            }
            prefs.edit().putString("host", host).apply()
            val mpm = getSystemService(MediaProjectionManager::class.java)
            projectionLauncher.launch(mpm.createScreenCaptureIntent())
        }

        stopBtn.setOnClickListener {
            startService(
                Intent(this, ScreenCastService::class.java).setAction(ScreenCastService.ACTION_STOP),
            )
        }

        // 서비스 상태 → 쉬운 문구
        lifecycleScope.launch {
            ScreenCastService.state.collectLatest { s ->
                statusText.text = when (s) {
                    "joining" -> getString(R.string.status_joining)
                    "connecting" -> getString(R.string.status_connecting)
                    "connected" -> getString(R.string.status_connected)
                    "reconnecting" -> getString(R.string.status_connecting)
                    "failed" -> getString(R.string.status_error)
                    "unreachable" -> getString(R.string.status_unreachable)
                    "expired", "wrong_code" -> getString(R.string.status_wrong_code)
                    else -> getString(R.string.status_idle)
                }
                val casting = s in listOf("joining", "connecting", "connected", "reconnecting")
                startBtn.visibility = if (casting) Button.GONE else Button.VISIBLE
                stopBtn.visibility = if (casting) Button.VISIBLE else Button.GONE
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    /** mirroron://send?code=123456&host=192.168.0.10:3000 */
    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "mirroron") return
        uri.getQueryParameter("code")?.let { codeInput.setText(it) }
        uri.getQueryParameter("host")?.let { hostInput.setText(it) }
    }
}
