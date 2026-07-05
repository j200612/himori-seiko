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
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// 靜態網頁託管
app.use(express.static(__dirname));

app.get('/admin-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'portal.html'));
});

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
        // A. 清空 Q&A 知識庫 (回歸乾淨空白狀態)
        const qaCol = firestore.collection('qa_database');
        const qaSnap = await qaCol.get();
        if (!qaSnap.empty) {
            console.log('🧹 偵測到舊 FAQ 條目，開始徹底抹除大谷保代資料，恢復空白狀態...');
            const batch = firestore.batch();
            qaSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log('✅ Firestore qa_database 已完全清空洗淨！');
        } else {
            console.log('🌱 Firestore qa_database 已是乾淨空白狀態。');
        }

        // B. 注入員工權限名冊 (user_roles)
        const roleCol = firestore.collection('user_roles');
        console.log('🌱 開始注入最高管理員與承攬團隊 Seed Data...');
        const seedRoles = [
            { id: 'admin01', name: '羅玉軒', title: '總裁', phone: '0937581112', role: 'admin', verified: true, otpEnabled: true },
            { id: 'emp201', name: '邱冠英', title: '工種:6S / 承攬夥伴', phone: '0912345001', role: 'contractor', dailyRate: 2400, verified: true },
            { id: 'emp202', name: '郭怡蘭', title: '工種:6S / 承攬夥伴', phone: '0912345002', role: 'contractor', dailyRate: 1950, verified: true },
            { id: 'emp203', name: '萬昱賢', title: '工種:6S / 承攬夥伴', phone: '0912345003', role: 'contractor', dailyRate: 1700, verified: true }
        ];
        for (const item of seedRoles) {
            await roleCol.doc(item.phone).set(item, { merge: true });
        }
        console.log('✅ user_roles Seed Data 注入/更新成功！');
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

// FAQ 一鍵清空 API
app.post('/api/firestore/qa/clear', async (req, res) => {
    try {
        const snap = await firestore.collection('qa_database').get();
        const batch = firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
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


// 員工權限名冊更新
app.post('/api/firestore/user-roles/update', async (req, res) => {
    try {
        const item = req.body;
        if (!item.phone) {
            return res.status(400).json({ error: 'Missing phone parameter' });
        }
        await firestore.collection('user_roles').doc(item.phone).set(item, { merge: true });
        res.json({ success: true });
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
                ]},
                { id: "emp104", name: "林小新", phone: "0987-654-321", status: "AI 自動回覆中", role: "member", history: [
                    { sender: "system", text: "歡迎加入日森精工林小新！您目前是【線上會員】，正在進行入職闖關。" }
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
// 輔助函式：整合 Gemini AI 智慧引導與 RAG 填表邏輯
async function processUserMessageWithGemini(userId, text, chat) {
    chat.formData = chat.formData || {
        name: '',
        phone: '',
        birthday: '',
        address: '',
        idNumber: '',
        emergencyContact: ''
    };
    chat.status = chat.status || 'pending';
    chat.isEdited = chat.isEdited !== undefined ? chat.isEdited : false;
    chat.auditLog = chat.auditLog || [];

    // 1. RAG 知識庫擷取
    const qaSnap = await firestore.collection('qa_database').get();
    let kbContent = '';
    qaSnap.forEach(qDoc => {
        const data = qDoc.data();
        kbContent += `Q: ${data.question}\nA: ${data.answer}\n關鍵字: ${data.keywords}\n\n`;
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        let aiReply = '';
        if (text.includes('試用期') || text.includes('津貼') || text.includes('薪資')) {
            aiReply = '🤖 已透過模擬大腦回覆您的 FAQ 問題。';
        } else {
            let parsed = {};
            if (text.match(/我是([^，。\s]+)/)) {
                parsed.name = text.match(/我是([^，。\s]+)/)[1];
            }
            if (text.match(/(09\d{2}-?\d{3}-?\d{3})/)) {
                parsed.phone = text.match(/(09\d{2}-?\d{3}-?\d{3})/)[1];
            }
            
            let changed = false;
            for (const key in parsed) {
                if (parsed[key] && chat.formData[key] !== parsed[key]) {
                    chat.formData[key] = parsed[key];
                    changed = true;
                }
            }
            if (changed) {
                chat.auditLog.push({
                    timestamp: new Date().toISOString(),
                    action: "USER_INPUT_AI_PARSED",
                    extractedData: parsed
                });
            }

            const fieldsMap = {
                name: '姓名',
                phone: '手機號碼',
                birthday: '生日',
                address: '地址',
                idNumber: '身分證字號',
                emergencyContact: '緊急聯絡人'
            };
            let missingField = null;
            for (const key in fieldsMap) {
                if (!chat.formData[key]) {
                    missingField = key;
                    break;
                }
            }

            if (missingField) {
                aiReply = `您好，感謝填寫。為了完成入職開通，請問您的【${fieldsMap[missingField]}】是多少呢？`;
            } else {
                aiReply = '您好！您的基本認證資料已經收集完畢，請等待主管審查入庫。';
            }
        }
        return aiReply;
    }

    const userPhone = (chat.phone || "").replace(/-/g, "").trim();
    const isAdmin = (userPhone === "0937581112");

    if (userPhone === '0912345001' || (chat.formData && chat.formData.phone && chat.formData.phone.replace(/-/g, '') === '0912345001')) {
        partnerInfoContext = `邱冠英本人資訊：預估報酬：出工 22 天 × 日薪 2400 = 52800 元（介紹費已永久取消歸零）。20 天津貼解鎖進度：22 天，已達成目標。`;
    } else if (userPhone === '0912345002' || (chat.formData && chat.formData.phone && chat.formData.phone.replace(/-/g, '') === '0912345002')) {
        partnerInfoContext = `郭怡蘭本人資訊：預估報酬：出工 22 天 × 日薪 1950 = 42900 元。20 天津貼解鎖進度：22 天，無常態津貼。`;
    } else if (userPhone === '0912345003' || (chat.formData && chat.formData.phone && chat.formData.phone.replace(/-/g, '') === '0912345003')) {
        partnerInfoContext = `萬昱賢本人資訊：預估報酬：出工 8 天 × 日薪 1700 = 13600 元，加計 6 月特准部分津貼（保險補貼 500 + 房租津貼 1000 = 1500 元），總計 15100 元。20 天津貼解鎖進度：8 天（因總裁特准破月，已直接解鎖部分津貼，免受常態 20 天門檻限制）。`;
    }

    const gagFirewallRule = isAdmin ? 
        `【管理員權限已啟動】：目前使用者是最高管理員「羅玉軒」（0937581112），您可以回答任何關於請款單價（平日基本 $2400、平日加班 $399/HR、週六前兩小時 $399/HR，第三小時起 $498/HR、週日與假日 $600/HR，每月10日前自動產出請款書）、所有承攬夥伴的津貼發放內幕與薪資明細的詢問。` :
        `【封口令安全防線已被剛性觸發】：目前使用者不是管理員，而是普通同仁。
如果使用者詢問敏感的請款單價（引發如：平日 $2400、平日加班 $399、週六前 2 小時 $399、第 3 小時起 $498、週日與假日 $600）、他人的津貼與薪資細節、或核心請款公式等：
1. 你必須【剛性拒絕並裝傻】，絕不透露任何具體數字、請款單價或公式！你可以幽默地說這是商業機密或開玩笑帶過，或委婉拒絕。
2. 你【只能】提供該同仁查詢本人的『預估報酬』與『20天工時津貼解鎖進度』，以下為該同仁本人的授權資料：
${partnerInfoContext || "（查無此人 6 月授權資料，請引導同仁向行政中心登記）"}`;

    const fieldsState = JSON.stringify(chat.formData, null, 2);
    const prompt = `你是一個專為日森精工 (Himori Seiko) 設計的官方帳號智能客服助理大腦。
你目前正在引導同仁填寫身分認證表格（必要欄位包括：姓名 name, 手機 phone, 生日 birthday, 地址 address, 身分證字號 idNumber, 緊急聯絡人 emergencyContact）。
請閱讀當前表格填寫狀態與使用者輸入：

【資安與權限規範】：
${gagFirewallRule}

【當前表格狀態】：
${fieldsState}

【知識庫內容】：
${kbContent}

【使用者輸入】：
${text}

【你的任務】：
1. 判斷使用者輸入中是否包含上述 6 個欄位中任何漏填的資訊。如果有，請在 JSON の extractedData 中提取出來（繁體中文，格式需工整）。
2. 檢查哪些欄位仍然是空的。
3. 如果使用者問的是敏感的資安保護資料且非管理員，請確實依據【資安與權限規範】進行拒絕。如果使用者問的是一般 FAQ 問題（例如詢問公司制度、福利等），且你可以從【知識庫內容】中找到精確答案，請在 reply 中直接親切地回答問題。
4. 如果使用者不是問 FAQ，或者回答了你之前問的表格資訊：
   - 如果還有空的必要欄位，請選取【其中一個】空欄位，用親切、引導的語氣詢問同仁（例如：『請問您的手機號碼是多少呢？』）。
   - 如果所有欄位都填滿了，請親切地告訴他：「您的基本資料已經填寫完整，我們會送交主管審核，謝謝您！」。
5. 如果在知識庫中找不到答案，且使用者沒有填寫資料，相似度信心不足，請在 reply 中回傳以 "[LOW_CONFIDENCE]" 開頭的字串，例如："[LOW_CONFIDENCE] 抱歉，我不確定這個問題的答案..."。

請嚴格以 JSON 格式輸出（不得包含 \`\`\`json 標記或額外說明字元）：
{
  "extractedData": {
    "name": "提取到的姓名，若無則為空字串",
    "phone": "提取到的手機，若無則為空字串",
    "birthday": "提取到的生日，若無則為空字串",
    "address": "提取到的地址，若無則為空字串",
    "idNumber": "提取到的身分證字號，若無則為空字串",
    "emergencyContact": "提取到的緊急聯絡人，若無則為空字串"
  },
  "reply": "你對使用者的親切回應"
}`;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const replyText = result.response.text().trim();
        
        const cleanJson = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        let changed = false;
        const newExtracted = {};
        if (parsed.extractedData) {
            for (const key in parsed.extractedData) {
                const val = parsed.extractedData[key] ? parsed.extractedData[key].trim() : '';
                if (val && chat.formData[key] !== val) {
                    chat.formData[key] = val;
                    newExtracted[key] = val;
                    changed = true;
                }
            }
        }

        if (changed) {
            chat.auditLog.push({
                timestamp: new Date().toISOString(),
                action: "USER_INPUT_AI_PARSED",
                extractedData: newExtracted
            });
        }

        return parsed.reply || '已收到您的訊息。';
    } catch (err) {
        console.error('Gemini API call or parsing failed in helper:', err);
        return '[LOW_CONFIDENCE] 抱歉，系統處理中，已為您通知真人客服接管。';
    }
}

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

        let aiReply = await processUserMessageWithGemini(chatId, text, chat);

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

// 取得後台顯示設定
app.get('/api/admin/display-settings', async (req, res) => {
    try {
        const ref = firestore.collection('system_config').doc('display_settings');
        const doc = await ref.get();
        if (doc.exists) {
            res.json(doc.data());
        } else {
            const defaultSettings = {
                fields: {
                    name: true,
                    phone: true,
                    birthday: true,
                    address: true,
                    idNumber: true,
                    emergencyContact: true
                }
            };
            res.json(defaultSettings);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 更新後台顯示設定
app.post('/api/admin/display-settings', async (req, res) => {
    try {
        const settings = req.body;
        const ref = firestore.collection('system_config').doc('display_settings');
        await ref.set(settings);
        res.json({ success: true, settings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 主管審查核准 API
app.post('/api/admin/approve-profile', async (req, res) => {
    try {
        const { userId, managerId, updatedFormData } = req.body;
        const ref = firestore.collection('line_chats').doc(userId);
        const doc = await ref.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        const chat = doc.data();
        const before = { ...chat.formData };

        let isEdited = chat.isEdited || false;
        if (updatedFormData) {
            for (const key in updatedFormData) {
                if (chat.formData[key] !== updatedFormData[key]) {
                    chat.formData[key] = updatedFormData[key];
                    isEdited = true;
                }
            }
        }

        chat.isEdited = isEdited;
        chat.status = 'approved';

        chat.auditLog = chat.auditLog || [];
        chat.auditLog.push({
            timestamp: new Date().toISOString(),
            action: "MANAGER_APPROVE",
            managerId: managerId || 'admin',
            before: before,
            after: chat.formData
        });

        const roleRef = firestore.collection('user_roles').doc(chat.formData.phone || chat.phone || userId);
        await roleRef.set({
            id: userId,
            name: chat.formData.name || chat.name || '',
            phone: chat.formData.phone || chat.phone || '',
            role: chat.role === 'guest' ? 'regular' : chat.role,
            verified: true,
            title: '正式同仁',
            birthday: chat.formData.birthday || '',
            address: chat.formData.address || '',
            idNumber: chat.formData.idNumber || '',
            emergencyContact: chat.formData.emergencyContact || ''
        }, { merge: true });

        await ref.set(chat);
        res.json({ success: true, chat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 手機預覽模擬畫面
app.get('/line/preview-mock', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).send('Missing userId parameter');
        }
        const ref = firestore.collection('line_chats').doc(userId);
        const doc = await ref.get();
        if (!doc.exists) {
            return res.status(404).send('User chat session not found');
        }
        const chat = doc.data();
        const formData = chat.formData || {};

        const setRef = firestore.collection('system_config').doc('display_settings');
        const setDoc = await setRef.get();
        let fieldsConfig = {
            name: true,
            phone: true,
            birthday: true,
            address: true,
            idNumber: true,
            emergencyContact: true
        };
        if (setDoc.exists) {
            fieldsConfig = setDoc.data().fields || fieldsConfig;
        }

        const fieldsMap = {
            name: '姓名',
            phone: '手機號碼',
            birthday: '生日',
            address: '地址',
            idNumber: '身分證字號',
            emergencyContact: '緊急聯絡人'
        };

        let fieldsHtml = '';
        for (const key in fieldsMap) {
            if (fieldsConfig[key]) {
                fieldsHtml += `
                    <div style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        <span style="font-weight: bold; color: #555; display: inline-block; width: 100px;">${fieldsMap[key]}：</span>
                        <span style="color: #333;">${formData[key] || '<span style="color: #ccc;">未填寫</span>'}</span>
                    </div>
                `;
            }
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LINE 手機端資料預覽</title>
            <style>
                body {
                    background-color: #f0f2f5;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                }
                .iphone-shell {
                    width: 360px;
                    height: 720px;
                    background-color: #000;
                    border-radius: 40px;
                    padding: 12px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    position: relative;
                }
                .iphone-screen {
                    background-color: #fff;
                    width: 100%;
                    height: 100%;
                    border-radius: 32px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .iphone-header {
                    height: 44px;
                    background-color: #06c755;
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-weight: bold;
                    position: relative;
                }
                .iphone-content {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                }
                .iphone-notch {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 150px;
                    height: 25px;
                    background-color: #000;
                    border-bottom-left-radius: 15px;
                    border-bottom-right-radius: 15px;
                    z-index: 100;
                }
                .card {
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
            </style>
        </head>
        <body>
            <div class="iphone-shell">
                <div class="iphone-notch"></div>
                <div class="iphone-screen">
                    <div class="iphone-header">
                        <span>日森精工 - 個人資料確認</span>
                    </div>
                    <div class="iphone-content">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #06c755;">
                            <h3 style="margin: 8px 0 2px 0;">\${chat.name}</h3>
                            <span style="font-size: 12px; color: #888; background: #eee; padding: 2px 8px; border-radius: 10px;">\${chat.role.toUpperCase()}</span>
                        </div>
                        <div class="card">
                            <h4 style="margin-top: 0; color: #06c755; border-bottom: 2px solid #06c755; padding-bottom: 6px;">基本認證資料</h4>
                            \${fieldsHtml}
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (e) {
        res.status(500).send('Internal Server Error: ' + e.message);
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

// 模擬或手動新增多媒體上傳 (整合 Gemini AI 智慧摘要與歸檔模組建議)
app.post('/api/inbox-media/add', async (req, res) => {
    try {
        const item = req.body;
        if (!item.id) item.id = String(Date.now());
        item.time = new Date().toISOString().replace('T', ' ').substring(0, 16);
        item.status = 'pending';

        // 串接 Gemini 實體大腦做影像/語意內容提取
        const apiKey = process.env.GEMINI_API_KEY;
        let aiSummary = '';
        let suggestedModule = '人事名冊'; // 預設歸檔模組

        const promptText = `
你是一個專門為日森精工 (Himori Seiko) 設計的後台 AI 助理大腦，負責自動辨識與分析同仁上傳的文件、圖片或純文字說明。
請分析以下傳入內容，為主管撰寫一份 50 字以內的【AI 智慧摘要】（繁體中文，提及姓名與重要內容欄位）。
同時，你需要對其進行智慧分類建議，推薦最適合歸檔的模組類型，必須「精確且只能」為【人事名冊】、【識別卡】或【團體保險】其中之一。

請嚴格回傳 JSON 格式，不要包含任何 markdown 標記（如 \`\`\`json）：
{
  "summary": "AI 智慧摘要內文...",
  "suggestedModule": "人事名冊" | "識別卡" | "團體保險"
}

【同仁傳入之元數據】：
- 傳送人：${item.sender || '未知同仁'}
- 傳送人電話：${item.phone || '無'}
- 上傳檔案名稱/類型：${item.type || '無'}
- 純文字備忘內容：${item.textMemo || '無'}
`;

        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                
                const parts = [promptText];

                // 嘗試處理實體 GCS 圖片或 PDF
                const mimeType = getMimeType(item.type || '');
                if (item.fileUrl && item.fileUrl !== '#' && mimeType) {
                    try {
                        const fileRes = await fetch(item.fileUrl);
                        const arrayBuffer = await fileRes.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        parts.push({
                            inlineData: {
                                data: base64,
                                mimeType: mimeType
                            }
                        });
                    } catch (fileErr) {
                        console.warn('GCS file fetch failed for Gemini, using metadata instead:', fileErr);
                    }
                }

                const result = await model.generateContent(parts);
                const replyText = result.response.text().trim();
                
                // 解析 JSON
                try {
                    const cleanJson = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    aiSummary = parsed.summary || '辨識完成，未能產生摘要。';
                    suggestedModule = parsed.suggestedModule || '人事名冊';
                } catch (jsonErr) {
                    console.error('Failed to parse Gemini JSON:', replyText, jsonErr);
                    aiSummary = replyText.substring(0, 100);
                }
            } catch (err) {
                console.error('Gemini API call failed for media analysis:', err);
                aiSummary = `[API 呼叫失敗] 同仁上傳 ${item.type || '文字'}。`;
            }
        }

        // Fallback 模擬邏輯 (無金鑰或失敗時)
        if (!aiSummary) {
            const searchSource = ((item.type || '') + ' ' + (item.textMemo || '')).toLowerCase();
            if (searchSource.includes("身分證") || searchSource.includes("申請書") || searchSource.includes("入會") || searchSource.includes("大同")) {
                aiSummary = `[模擬 AI 辨識] 偵測為同仁身分證或入會加保申請書，已識別出同仁姓名個資與通訊電話。`;
                suggestedModule = '人事名冊';
            } else if (searchSource.includes("識別卡") || searchSource.includes("識別證") || searchSource.includes("證照") || searchSource.includes("天車")) {
                aiSummary = `[模擬 AI 辨識] 偵測為員工工作識別證或拉線、天車專業證照，已自動識別卡號與有效期限。`;
                suggestedModule = '識別卡';
            } else if (searchSource.includes("保險") || searchSource.includes("保單") || searchSource.includes("團保") || searchSource.includes("健保")) {
                aiSummary = `[模擬 AI 辨識] 偵測為團體保險加保憑據或扣費帳單，已辨識生效日期與扣繳薪資級距。`;
                suggestedModule = '團體保險';
            } else {
                aiSummary = `[模擬 AI 辨識] 同仁傳送文字："${item.textMemo || item.type}"。主動提取關鍵字並推薦分流。`;
                suggestedModule = '人事名冊';
            }
        }

        item.aiSummary = aiSummary;
        item.suggestedModule = suggestedModule;

        await firestore.collection('inbox_media').doc(item.id).set(item);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper: 取得 Mime Type
function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return null;
}

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


// ── 6. 實體 LINE Webhook 整合與安全簽章驗證 ──
const crypto = require('crypto');
const https = require('https');

let cachedToken = null;
let tokenExpiry = 0;

async function getLineAccessToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }
    const channelId = process.env.LINE_CHANNEL_ID || '2010235006';
    const channelSecret = process.env.LINE_CHANNEL_SECRET || 'fd39f1d853b48d294ce823a1082a3fb1';
    
    return new Promise((resolve, reject) => {
        const tokenParams = `grant_type=client_credentials&client_id=${channelId}&client_secret=${channelSecret}`;
        const options = {
            hostname: 'api.line.me',
            path: '/v2/oauth/accessToken',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        cachedToken = parsed.access_token;
                        tokenExpiry = Date.now() + (parsed.expires_in - 60) * 1000;
                        resolve(cachedToken);
                    } else {
                        reject(new Error(data));
                    }
                } catch(e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(tokenParams);
        req.end();
    });
}

async function replyLineMessage(replyToken, text) {
    const accessToken = await getLineAccessToken();
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            replyToken: replyToken,
            messages: [{ type: 'text', text: text }]
        });
        const options = {
            hostname: 'api.line.me',
            path: '/v2/bot/message/reply',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve(data);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function verifyLineSignature(req, res, next) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET || 'fd39f1d853b48d294ce823a1082a3fb1';
    const signature = req.headers['x-line-signature'];
    
    if (!signature) {
        return res.status(401).send('Missing signature');
    }
    
    const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(req.rawBody || Buffer.from(''))
        .digest('base64');
        
    if (hash !== signature) {
        console.warn('LINE signature verification failed!');
        return res.status(401).send('Invalid signature');
    }
    next();
}

app.post('/api/line/webhook', verifyLineSignature, async (req, res) => {
    try {
        const events = req.body.events || [];
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const replyToken = event.replyToken;
                const userText = event.message.text.trim();
                
                if (replyToken === '00000000000000000000000000000000' || replyToken === 'ffffffffffffffffffffffffffffffff') {
                    console.log('LINE Webhook verification check event received.');
                    continue;
                }
                
                const ref = firestore.collection('line_chats').doc(userId);
                const doc = await ref.get();
                let chat;
                if (!doc.exists) {
                    chat = {
                        id: userId,
                        name: `訪客 (${userId.substring(0, 6)})`,
                        phone: '—',
                        role: 'guest',
                        status: 'pending',
                        history: [],
                        formData: {
                            name: '',
                            phone: '',
                            birthday: '',
                            address: '',
                            idNumber: '',
                            emergencyContact: ''
                        },
                        isEdited: false,
                        auditLog: []
                    };
                } else {
                    chat = doc.data();
                }
                
                chat.history.push({ sender: 'user', text: userText });
                
                let aiReply = '';
                if (userText === '🔑 綁定手機 ✖ 註冊日森會員（入職領證通道）' || userText === 'auth') {
                    aiReply = `歡迎使用日森精工數位客服平台！\n👉 請點擊以下連結進行手機綁定與身分註冊：\nhttps://himori-portal-650268834354.asia-east1.run.app/modules/02_LINE_Office/line_hub/line_hub.html?userId=${userId}`;
                } else if (userText === '🏢 日森精工 官方網站') {
                    aiReply = '日森精工有限公司 官方入口：\nhttps://himori-portal-650268834354.asia-east1.run.app';
                } else if (userText === '💬 聯絡真人 雲端客服' || userText === '真人接管') {
                    chat.status = '🚨 待真人接管';
                    aiReply = '已為您通知日森工務真人客服，我們將儘速接入與您對話，請稍候...';
                } else if (userText === '今日排班') {
                    if (chat.phone !== '—') {
                        aiReply = `🤖 日森精工 | 今日排班資訊：\n工作案場：台積電F20\n施工分區：6S整理整頓\n領隊：李志強\n出勤日期：2026-06-28`;
                    } else {
                        aiReply = '您目前尚未進行身份認證，請先點選選單中的「🔑 認證開通」綁定手機。';
                    }
                } else {
                    aiReply = await processUserMessageWithGemini(userId, userText, chat);
                    
                    if (aiReply.includes('[LOW_CONFIDENCE]')) {
                        chat.status = '🚨 待真人接管';
                        aiReply = aiReply.replace('[LOW_CONFIDENCE]', '').trim();
                    } else {
                        chat.status = 'AI 自動回覆中';
                    }
                }
                
                chat.history.push({ sender: 'system', text: aiReply });
                await ref.set(chat);
                await replyLineMessage(replyToken, aiReply);
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error('Error in LINE Webhook handler:', err);
        res.status(500).send('Internal Server Error');
    }
});


// 啟動伺服器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
