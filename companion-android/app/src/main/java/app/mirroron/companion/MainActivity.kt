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
    private lateinit var titleView: TextView
    private lateinit var statusText: TextView
    private lateinit var startBtn: Button
    private lateinit var stopBtn: Button

    // 배포 주소 고정 — 초보자는 숫자 6개만 입력하면 됨.
    private val DEFAULT_HOST = "25o.netlify.app"

    private fun currentHost(): String {
        val saved = getSharedPreferences("mirroron", Context.MODE_PRIVATE).getString("host", "")
        return if (saved.isNullOrBlank()) DEFAULT_HOST else saved
    }

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            val intent = Intent(this, ScreenCastService::class.java)
                .putExtra(ScreenCastService.EXTRA_PROJECTION, data)
                .putExtra(ScreenCastService.EXTRA_CODE, codeInput.text.toString().trim())
                .putExtra(ScreenCastService.EXTRA_HOST, currentHost())
            startForegroundService(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CrashReporter.install(this)
        setContentView(R.layout.activity_main)

        codeInput = findViewById(R.id.codeInput)
        hostInput = findViewById(R.id.hostInput)
        titleView = findViewById(R.id.title)
        statusText = findViewById(R.id.statusText)
        startBtn = findViewById(R.id.startBtn)
        stopBtn = findViewById(R.id.stopBtn)

        // 주소칸은 기본 숨김(고정 주소). 제목을 길게 누르면 나타남(주소 변경용 숨은 옵션).
        hostInput.setText(currentHost())
        titleView.setOnLongClickListener {
            hostInput.visibility = android.view.View.VISIBLE
            true
        }

        handleDeepLink(intent)

        startBtn.setOnClickListener {
            val code = codeInput.text.toString().trim()
            // 주소칸이 열려 있으면 그 값을 저장(변경), 아니면 고정 주소 사용
            if (hostInput.visibility == android.view.View.VISIBLE) {
                val h = hostInput.text.toString().trim()
                getSharedPreferences("mirroron", Context.MODE_PRIVATE).edit()
                    .putString("host", h.ifBlank { DEFAULT_HOST }).apply()
            }
            if (code.length != 6) {
                statusText.text = getString(R.string.subtitle)
                return@setOnClickListener
            }
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

    /** mirroron://send?code=123456&host=25o.netlify.app */
    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "mirroron") return
        uri.getQueryParameter("code")?.let { codeInput.setText(it) }
        // 딥링크에 host가 오면 저장(고정 주소 갱신)
        uri.getQueryParameter("host")?.let { h ->
            getSharedPreferences("mirroron", Context.MODE_PRIVATE).edit().putString("host", h).apply()
        }
    }
}
