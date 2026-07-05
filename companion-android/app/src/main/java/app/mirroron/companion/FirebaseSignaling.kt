package app.mirroron.companion

import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.Query
import com.google.firebase.database.ServerValue
import com.google.firebase.database.ValueEventListener
import org.json.JSONObject
import android.content.Context

/**
 * Firebase Realtime Database 시그널링 — 웹(lib/signaling.ts)과 동일한 경로·규칙.
 *   signals/{channel}/{pushId} = { sid, at, type, from, to, payload }
 * 자기 메시지는 sid로 필터, 구독 시점(at >= startedAt) 이후만 수신.
 *
 * google-services.json 없이 런타임에 받은 config로 초기화한다.
 */
class FirebaseSignaling(
    private val db: FirebaseDatabase,
    private val channel: String,
    private val onMessage: (JSONObject) -> Unit,
) {
    private val sid = List(10) { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
    private val safeChannel = channel.replace(Regex("[.#$/\\[\\]]"), "_")
    private val listRef = db.getReference("signals/$safeChannel")
    private var listener: ChildEventListener? = null
    private var attachedQuery: Query? = null

    fun start() {
        listener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val msgSid = snapshot.child("sid").getValue(String::class.java)
                if (msgSid == sid) return // 자기 메시지 무시
                val obj = JSONObject()
                obj.put("type", snapshot.child("type").getValue(String::class.java) ?: "")
                obj.put("from", snapshot.child("from").getValue(String::class.java) ?: "")
                snapshot.child("to").getValue(String::class.java)?.let { obj.put("to", it) }
                val payloadSnap = snapshot.child("payload")
                obj.put("payload", snapshotToJson(payloadSnap))
                onMessage(obj)
            }
            override fun onChildChanged(s: DataSnapshot, p: String?) {}
            override fun onChildRemoved(s: DataSnapshot) {}
            override fun onChildMoved(s: DataSnapshot, p: String?) {}
            override fun onCancelled(e: DatabaseError) {}
        }
        // "구독 이후 새 메시지만" — 마지막 기존 push키 이후만 수신 (시계 무관, 과거 재생 방지)
        listRef.limitToLast(1).addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snap: DataSnapshot) {
                var lastKey: String? = null
                for (c in snap.children) lastKey = c.key
                val q: Query = if (lastKey != null) listRef.orderByKey().startAfter(lastKey) else listRef
                attachedQuery = q
                listener?.let { q.addChildEventListener(it) }
            }
            override fun onCancelled(e: DatabaseError) {
                attachedQuery = listRef
                listener?.let { listRef.addChildEventListener(it) }
            }
        })
    }

    fun send(msg: JSONObject) {
        val entry = HashMap<String, Any?>()
        entry["sid"] = sid
        entry["at"] = ServerValue.TIMESTAMP
        entry["type"] = msg.optString("type")
        entry["from"] = msg.optString("from")
        if (msg.has("to")) entry["to"] = msg.optString("to")
        entry["payload"] = jsonToMap(msg.optJSONObject("payload") ?: JSONObject())
        listRef.push().setValue(entry)
    }

    fun close() {
        listener?.let { l -> (attachedQuery ?: listRef).removeEventListener(l) }
        listener = null
        attachedQuery = null
    }

    private fun snapshotToJson(snap: DataSnapshot): JSONObject {
        val o = JSONObject()
        for (child in snap.children) {
            val v = child.value
            if (v is Map<*, *>) o.put(child.key, snapshotToJson(child)) else o.put(child.key, v)
        }
        return o
    }

    private fun jsonToMap(obj: JSONObject): Map<String, Any?> {
        val map = HashMap<String, Any?>()
        for (key in obj.keys()) {
            when (val v = obj.get(key)) {
                is JSONObject -> map[key] = jsonToMap(v)
                else -> map[key] = v
            }
        }
        return map
    }

    companion object {
        /** 배포 서버의 /api/config 값으로 Firebase 초기화 (앱 전역 1회) */
        fun initDatabase(context: Context, config: JSONObject): FirebaseDatabase {
            val apiKey = config.getString("apiKey")
            val dbUrl = config.getString("databaseURL")
            val appId = config.getString("appId")
            val projectId = config.getString("projectId")

            val options = FirebaseOptions.Builder()
                .setApiKey(apiKey)
                .setDatabaseUrl(dbUrl)
                .setApplicationId(appId)
                .setProjectId(projectId)
                .build()

            val existing = FirebaseApp.getApps(context).firstOrNull { it.name == "mirroron" }
            val app = existing ?: FirebaseApp.initializeApp(context, options, "mirroron")
            return FirebaseDatabase.getInstance(app)
        }

        /** rooms/{code}/meta 존재·만료 확인 (Firebase 모드 룸 조인) */
        fun roomExists(snap: DataSnapshot): Boolean {
            if (!snap.exists()) return false
            val exp = snap.child("expiresAt").getValue(Long::class.java) ?: return true
            return exp > System.currentTimeMillis()
        }
    }
}
