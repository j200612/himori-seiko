const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態網頁託管
app.use(express.static(__dirname));

// GCP 初始化
const projectId = process.env.GCP_PROJECT_ID || 'himori-seiko-2006';
const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });

const bucketName = process.env.GCS_BUCKET_NAME || 'himori-seiko-2006-media';
const bucket = storage.bucket(bucketName);

// 🔍 自動檢查並建立 GCS 儲存桶
bucket.exists().then(([exists]) => {
    if (!exists) {
        bucket.create({ location: 'asia-east1' }).then(() => {
            console.log(`Bucket ${bucketName} created successfully in asia-east1.`);
        }).catch(err => console.error('Error creating bucket:', err));
    }
}).catch(err => console.error('Error checking bucket exists:', err));

// Multer 記憶體儲存設定
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ── 1. 自動注入 Seed Data ──
async function seedDatabase() {
    try {
        // A. 注入 Q&A 知識庫
        const qaCol = firestore.collection('qa_database');
        const qaSnap = await qaCol.limit(1).get();
        if (qaSnap.empty) {
            console.log('🌱 Firestore qa_database 為空，開始注入 Seed Data...');
            const seedQa = [
                {
                    id: 'seed_qa_1',
                    category: '一般制度',
                    question: '試用期間多長？',
                    answer: '日森精工同仁基本試用期間為一個月，考核通過後轉為正式正職同仁。',
                    keywords: '試用期,試用期間,考核',
                    time: new Date().toISOString().substring(0, 10)
                },
                {
                    id: 'seed_qa_2',
                    category: '薪資福利',
                    question: '薪資中是否有伙食津貼？',
                    answer: '本公司薪資結構中固定內含 3,000 元伙食津貼，依法免稅。',
                    keywords: '伙食津貼,伙食費,津貼',
                    time: new Date().toISOString().substring(0, 10)
                },
                {
                    id: 'seed_qa_3',
                    category: '薪資福利',
                    question: '發薪日是哪一天？',
                    answer: '公司薪資固定於每月 15 日發放，若遇例假日則順延或提前發放。',
                    keywords: '發薪,發薪日,領薪水,薪水,發放薪資',
                    time: new Date().toISOString().substring(0, 10)
                },
                {
                    id: 'seed_qa_4',
                    category: '工會行政',
                    question: '工會加保表單與申請書下載？',
                    answer: '工會入會申請書下載路徑為：勞動力工會-入會申請書11501.pdf。王大同 A4 填寫範例對照下載路徑為：勞動力工會-入會申請書11501_範例.pdf。',
                    keywords: '工會申請書,加保表單,空白申請書,範例',
                    time: new Date().toISOString().substring(0, 10)
                }
            ];
            for (const item of seedQa) {
                await qaCol.doc(item.id).set(item);
            }
            console.log('✅ qa_database Seed Data 注入成功！');
        }

        // B. 注入員工權限名冊 (user_roles)
        const roleCol = firestore.collection('user_roles');
        const roleSnap = await roleCol.limit(1).get();
        if (roleSnap.empty) {
            console.log('🌱 Firestore user_roles 為空，開始注入 Seed Data...');
            const seedRoles = [
                { id: 'emp101', name: '李志強', title: '工程主任 / 領隊', phone: '0923-456-789', role: 'regular', verified: true },
                { id: 'emp102', name: '張憲明', title: '拉線組長', phone: '0912-345-678', role: 'contractor', verified: false },
                { id: 'emp103', name: '王大同', title: '技術專員', phone: '0934-567-890', role: 'contractor', verified: false }
            ];
            for (const item of seedRoles) {
                await roleCol.doc(item.phone).set(item);
            }
            console.log('✅ user_roles Seed Data 注入成功！');
        }
    } catch (e) {
        console.error('Seed database error:', e);
    }
}

seedDatabase();


// ── 2. Firestore API ──

// FAQ 讀取
app.get('/api/firestore/qa', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 新增/修改
app.post('/api/firestore/qa', async (req, res) => {
    try {
        const item = req.body;
        if (!item.id) item.id = 'qa_' + Date.now();
        item.time = new Date().toISOString().substring(0, 10);
        await firestore.collection('qa_database').doc(item.id).set(item);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FAQ 刪除
app.delete('/api/firestore/qa/:id', async (req, res) => {
    try {
        await firestore.collection('qa_database').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 員工權限對齊名冊讀取
app.get('/api/firestore/user-roles', async (req, res) => {
    try {
        const snap = await firestore.collection('user_roles').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 手動開通/取消認證
app.post('/api/firestore/user-roles/verify', async (req, res) => {
    try {
        const { phone, verified } = req.body;
        const ref = firestore.collection('user_roles').doc(phone);
        const doc = await ref.get();
        if (doc.exists) {
            await ref.update({ verified: !!verified });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User phone not found in roster.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── 3. Google Cloud Storage 上傳 API ──
app.post('/api/storage/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const ext = path.extname(req.file.originalname);
        const gcsFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const blob = bucket.file(gcsFileName);
        
        const blobStream = blob.createWriteStream({
            metadata: { contentType: req.file.mimetype },
            resumable: false
        });

        blobStream.on('error', (err) => {
            res.status(500).json({ error: err.message });
        });

        blobStream.on('finish', async () => {
            // 設定公開存取權限
            try {
                await blob.makePublic();
            } catch (e) {
                // 如果權限不允許，回退使用儲存桶內簽名或公開連結
                console.warn('Could not make blob public, using standard URL:', e);
            }
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
            res.json({ url: publicUrl, fileName: req.file.originalname });
        });

        blobStream.end(req.file.buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── 4. LINE Webhook 仿真與 Gemini API 大腦 (RAG + 信心門檻) ──

// 取得所有模擬聊天對話
app.get('/api/line/chats', async (req, res) => {
    try {
        const snap = await firestore.collection('line_chats').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        
        // 如果為空，寫入預設初始值
        if (list.length === 0) {
            const defaults = [
                { id: "guest_123", name: "訪客 (未認證)", phone: "—", status: "AI 自動回覆中", role: "guest", history: [
                    { sender: "system", text: "歡迎加入日森精工數位客服平台！請輸入您的問題，或點選下方選單進行身分認證。" }
                ]},
                { id: "emp101", name: "李志強", phone: "0923-456-789", status: "AI 自動回覆中", role: "regular", history: [
                    { sender: "system", text: "您好，李志強 主任！請問需要什麼協助？" }
                ]},
                { id: "emp102", name: "張憲明", phone: "0912-345-678", status: "已解決", role: "contractor", history: [
                    { sender: "system", text: "您好，張憲明 同仁！請問需要什麼協助？" },
                    { sender: "user", text: "今日排班" },
                    { sender: "system", text: "🤖 日森精工 | 今日排班資訊：\n工作案場：台積電F20\n施工分區：6S整理整頓\n領隊：李志強\n出勤日期：2026-06-15" }
                ]}
            ];
            for (const item of defaults) {
                await firestore.collection('line_chats').doc(item.id).set(item);
                list.push(item);
            }
        }
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 發送 LINE 使用者訊息 (觸發 AI 大腦)
app.post('/api/line/message', async (req, res) => {
    try {
        const { chatId, text } = req.body;
        const ref = firestore.collection('line_chats').doc(chatId);
        const doc = await ref.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Chat session not found.' });
        }

        const chat = doc.data();
        chat.history.push({ sender: 'user', text });

        // A. 抓取知識庫作為 Context (RAG)
        const qaSnap = await firestore.collection('qa_database').get();
        let kbContent = '';
        qaSnap.forEach(qDoc => {
            const data = qDoc.data();
            kbContent += `Q: ${data.question}\nA: ${data.answer}\n關鍵字: ${data.keywords}\n\n`;
        });

        // B. 組裝 Prompt 給 Gemini
        const prompt = `你是一個專為日森精工 (Himori Seiko) 設計的官方官方帳號智能客服助理大腦。
請嚴格且誠實地依據下方提供的【知識庫內容】回答使用者的問題。

【知識庫內容】：
${kbContent}

【使用者問題】：
${text}

【答覆規則】：
1. 你的回答必須專業、親切、簡短，且「完全依據知識庫」回答。
2. 🚨【核心信心防線】：如果在知識庫內容中，找不到答案，或者相似度信心不足（例如問非本公司業務、外來業務或計算非 FAQ 設定之保費等），請【絕對不要】編造答案！你必須在回答的最前方加上 "[LOW_CONFIDENCE]" 標記，其後回答 "抱歉，我不確定這個問題的答案。已經為您通知真人客服接管，請稍候..." 即可。`;

        // C. 調用 Gemini API
        let aiReply = '';
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(prompt);
                aiReply = result.response.text().trim();
            } catch (err) {
                console.error('Gemini API call failed:', err);
                aiReply = '[LOW_CONFIDENCE] 抱歉，我不確定這個問題的答案。已為您通知真人客服接管。';
            }
        } else {
            // 無金鑰測試 fallback 邏輯
            if (text.includes('試用期') || text.includes('津貼') || text.includes('薪資')) {
                aiReply = '🤖 已透過模擬大腦回覆您的 FAQ 問題。';
            } else {
                aiReply = '[LOW_CONFIDENCE] 抱歉，我不確定這個問題的答案。已為您通知真人客服接管。';
            }
        }

        // D. 處理信心防線拦截
        if (aiReply.includes('[LOW_CONFIDENCE]')) {
            chat.status = '🚨 待真人接管';
            aiReply = aiReply.replace('[LOW_CONFIDENCE]', '').trim();
        } else {
            chat.status = 'AI 自動回覆中';
        }

        chat.history.push({ sender: 'system', text: aiReply });
        await ref.set(chat);

        res.json({ success: true, chat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 管理員真人回覆 API
app.post('/api/line/reply', async (req, res) => {
    try {
        const { chatId, text } = req.body;
        const ref = firestore.collection('line_chats').doc(chatId);
        const doc = await ref.get();
        if (doc.exists) {
            const chat = doc.data();
            chat.history.push({ sender: 'agent', text });
            chat.status = '已由真人回覆';
            await ref.set(chat);
            res.json({ success: true, chat });
        } else {
            res.status(404).json({ error: 'Chat not found.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── 5. 多媒體與證照收件匣 API (分頁三) ──

// 取得多媒體收件匣
app.get('/api/inbox-media', async (req, res) => {
    try {
        const snap = await firestore.collection('inbox_media').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 核准與智慧分流歸檔
app.post('/api/inbox-media/approve', async (req, res) => {
    try {
        const { id, targetModule } = req.body;
        const ref = firestore.collection('inbox_media').doc(String(id));
        const doc = await ref.get();
        if (doc.exists) {
            const item = doc.data();
            item.status = 'approved';
            item.dispatchedTo = targetModule;
            await ref.set(item);

            // 雙向寫入歸檔歷史 log
            const logEntry = {
                id: 'log_' + Date.now(),
                fileId: id,
                fileName: item.type,
                sender: item.sender,
                phone: item.phone,
                dispatchedTo: targetModule,
                timestamp: new Date().toISOString(),
                status: 'archived_success'
            };
            await firestore.collection('archived_logs').doc(logEntry.id).set(logEntry);

            res.json({ success: true, item, logEntry });
        } else {
            res.status(404).json({ error: 'Inbox item not found.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 駁回上傳文件
app.post('/api/inbox-media/reject', async (req, res) => {
    try {
        const { id } = req.body;
        const ref = firestore.collection('inbox_media').doc(String(id));
        const doc = await ref.get();
        if (doc.exists) {
            const item = doc.data();
            item.status = 'rejected';
            await ref.set(item);
            res.json({ success: true, item });
        } else {
            res.status(404).json({ error: 'Inbox item not found.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 刪除收件匣檔案紀錄
app.post('/api/inbox-media/delete', async (req, res) => {
    try {
        const { id } = req.body;
        await firestore.collection('inbox_media').doc(String(id)).delete();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 模擬或手動新增多媒體上傳
app.post('/api/inbox-media/add', async (req, res) => {
    try {
        const item = req.body;
        if (!item.id) item.id = String(Date.now());
        item.time = new Date().toISOString().replace('T', ' ').substring(0, 16);
        item.status = 'pending';
        
        await firestore.collection('inbox_media').doc(item.id).set(item);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 清空收件匣
app.post('/api/inbox-media/clear', async (req, res) => {
    try {
        const snap = await firestore.collection('inbox_media').get();
        const batch = firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// 啟動伺服器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
