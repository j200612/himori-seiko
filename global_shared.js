// ==================== 日森精工 | 數位營運中心 共享數據中心 ====================
// 本檔案負責跨模組（iframe）的資料庫存取、統一初始化、SaaS 模組管理與自動自我修復。

(function(global) {
    // 預設公司品牌識別配置
    const defaultCompanyConfig = {
        name: "日森精工有限公司",
        engName: "HIMORI SEIKO Co., Ltd.",
        logoHorizontal: "01_企業識別與設計/橫式logo.png",
        logoVertical: "01_企業識別與設計/直式logo.png",
        backgroundImg: "01_企業識別與設計/底色.png",
        slogan: "安全・合規・韌性・精密",
        description: "日森精工專注於半導體晶圓廠區、高科技無塵室之6S廠務維護、精密天車軌道安裝校正、機電整合工程與工安合規管理，提供高彈性與高韌性的廠房後勤支援。",
        email: "admin@himori-seiko.com",
        address: "台北市大安區信義路四段1號2樓",
        taxId: "日森精工有限公司 62097937",
        cardFront: "modules/02_LINE_Office/employee_cards/card_front.png",
        cardBack: "modules/02_LINE_Office/employee_cards/card_back.png",
        modulesVersionTags: {
            base_brand: "v1.0.0",
            base_hr: "v1.0.0",
            base_permissions: "v1.0.0",
            func_employee_cards: "v1.0.0",
            func_work_dispatch: "v1.0.0",
            func_attendance: "v1.0.0",
            func_group_insurance: "v1.0.0",
            func_internal_acc: "v1.0.0",
            func_external_acc: "v1.0.0",
            func_e_invoicing: "v1.0.0",
            func_board_meeting: "v1.0.0",
            func_line_hub: "v1.0.0"
        }
    };

    // 系統 SaaS 模組註冊中心 (一般類與功能類)
    const HimoriModules = {
        base_brand: {
            category: 'base',
            name: '🎨 企業識別模組',
            version: '1.0.0',
            src: 'modules/01_Core_Base/base/brand/brand.html',
            desc: '管理公司名稱、Logo、底色與官方網站內容',
            dependencies: []
        },
        base_hr: {
            category: 'base',
            name: '👥 員工名冊模組',
            version: '1.0.0',
            src: 'modules/01_Core_Base/base/hr/hr_base.html',
            desc: '最基礎的同仁名冊與通訊錄登記',
            dependencies: []
        },
        base_permissions: {
            category: 'base',
            name: '⚙️ 權限訂閱模組',
            version: '1.0.0',
            src: 'modules/01_Core_Base/base/permissions/permissions.html',
            desc: '配置同仁帳號角色，以及模擬 SaaS 模組加購與品牌客製化',
            dependencies: []
        },
        func_employee_cards: {
            category: 'functional',
            name: '📇 電子名片模組',
            version: '1.0.0',
            src: 'modules/02_LINE_Office/employee_cards/employee_cards.html',
            desc: '設計與開啟同仁電子名片，設定聯絡資訊',
            dependencies: ['base_hr']
        },
        func_work_dispatch: {
            category: 'functional',
            name: '🏗️ 排班派工模組',
            version: '1.0.0',
            src: 'modules/03_Industry_Modules/Himori_Project/work_dispatch/work_dispatch.html',
            desc: '工程排班排程、派工指派與現場出勤追蹤',
            dependencies: ['base_hr']
        },
        func_attendance: {
            category: 'functional',
            name: '📅 假勤酬勞模組',
            version: '1.0.0',
            src: 'modules/02_LINE_Office/attendance/attendance.html',
            desc: '每日出勤明細核對、異常對帳與假單線上審批',
            dependencies: ['func_work_dispatch']
        },
        func_group_insurance: {
            category: 'functional',
            name: '🛡️ 團保作業模組',
            version: '1.0.0',
            src: 'modules/03_Industry_Modules/Himori_Project/group_insurance/group_insurance.html',
            desc: '辦理加保/退保、增額投保與保費送件檔(CSV)匯出',
            dependencies: ['base_hr']
        },
        func_internal_acc: {
            category: 'base',
            name: '📊 營運內帳模組',
            version: '1.0.0',
            src: 'modules/01_Core_Base/internal_acc/internal_accounting.html',
            desc: '公司平日現金與存款流水帳、請款憑證照片上傳與日誌統計',
            dependencies: []
        },
        func_external_acc: {
            category: 'functional',
            name: '🧾 財會外帳模組',
            version: '1.0.0',
            src: 'modules/03_Industry_Modules/Himori_Project/external_acc/external_accounting.html',
            desc: '模擬會計師報稅發票對碰、營業稅/營所稅估算與內外帳落差分析',
            dependencies: ['func_internal_acc']
        },
        func_e_invoicing: {
            category: 'base',
            name: '🧾 電子發票模組',
            version: '1.0.0',
            src: 'modules/01_Core_Base/e_invoicing/e_invoicing.html',
            desc: '模擬電子發票開立、發送、折讓與作廢歷史管理',
            dependencies: []
        },
        func_board_meeting: {
            category: 'functional',
            name: '👑 股東權益模組',
            version: '1.0.0',
            src: 'modules/03_Industry_Modules/Himori_Project/board_meeting/board_meeting.html',
            desc: '查看股權分配、EPS、預算對比圖表與損益平衡決策分析',
            dependencies: []
        },
        func_line_hub: {
            category: 'functional',
            name: '💬 LINE 智能客服',
            version: '1.0.0',
            src: 'modules/02_LINE_Office/line_hub/line_hub.html',
            desc: '白牌 LINE 自動客服、人機協同聊天室、多媒體收件匣與 Rich Menu 動態配置平台',
            dependencies: ['base_hr']
        },
        func_recruitment: {
            category: 'functional',
            name: '⏳ 準員工招募與通關模組',
            version: '1.0.0',
            src: 'modules/02_LINE_Office/recruitment/recruitment.html',
            desc: '準員工招募廣告渠道追蹤、入職兩階段文件審查、科技廠識別證開通與進度控制中心',
            dependencies: ['base_hr']
        },
        func_billing_payroll: {
            category: 'base',
            name: '💵 發薪與請款對帳模組',
            version: '1.0.0',
            src: 'modules/03_Payroll_Office/billing_payroll.html',
            desc: '雙軌算力工時發薪對帳請款模組，進行上游請款與內部夥伴報酬、黃金津貼對帳',
            dependencies: []
        }
    };

    // 預設資料庫參數
    const defaults = {
        params: { otRate: 1.5, holidayRate: 1.5, leadRate: 100, bonusDays: 22, bonusAmount: 3000 },
        tradesDb: { "6S": 2400, "拉線工程": 2500, "接線工程": 2800 },
        employeeDb: {
            "邱冠英": { specialty: "6S", transAllow: 0, lodgAllow: 0, profAllow: 0, isLead: false, laborType: "contract", dailyRate: 2400, referrer: null, phone: "0912-345-001", cardNo: "HIMORI-QA-001", idImages: { front: "encrypted_id_front_hash_qiu", back: "encrypted_id_back_hash_qiu" } },
            "郭怡蘭": { specialty: "6S", transAllow: 0, lodgAllow: 0, profAllow: 0, isLead: false, laborType: "contract", dailyRate: 1950, referrer: null, phone: "0912-345-002", cardNo: "HIMORI-QA-002", idImages: { front: "encrypted_id_front_hash_guo", back: "encrypted_id_back_hash_guo" } },
            "萬昱賢": { specialty: "6S", transAllow: 2000, lodgAllow: 3000, profAllow: 0, isLead: false, laborType: "contract", dailyRate: 1700, referrer: null, phone: "0912-345-003", cardNo: "HIMORI-QA-003", idImages: { front: "encrypted_id_front_hash_wan", back: "encrypted_id_back_hash_wan" } }
        },
        rosterDb: [
            { date: "2026-06-12", createdDate: "2026-06-10", name: "邱冠英", site: "村田機械", zone: "6S整理整頓", status: "已接受" },
            { date: "2026-06-12", createdDate: "2026-06-10", name: "郭怡蘭", site: "村田機械", zone: "6S整理整頓", status: "已接受" },
            { date: "2026-06-13", createdDate: "2026-06-10", name: "邱冠英", site: "村田機械", zone: "6S整理整頓", status: "已接受" },
            { date: "2026-06-13", createdDate: "2026-06-10", name: "郭怡蘭", site: "村田機械", zone: "6S整理整頓", status: "已接受" }
        ],
        attendanceLogs: (function() {
            const logs = [];
            const qiuGuoDates = [
                "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-08", "2026-06-09",
                "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-15",
                "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-22",
                "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27",
                "2026-06-29", "2026-06-30"
            ];
            const wanDates = [
                "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26",
                "2026-06-27", "2026-06-29", "2026-06-30"
            ];
            
            qiuGuoDates.forEach(date => {
                let hours = 8;
                let note = "正常工時";
                if (date === "2026-06-12") {
                    hours = 12;
                    note = "加班4小時 (08:58 - 21:01)";
                } else if (date === "2026-06-13") {
                    hours = 9;
                    note = "週六加班1小時 (08:58 - 18:01)";
                } else if (date === "2026-06-06" || date === "2026-06-27") {
                    note = "週六基本工時";
                }
                logs.push({ date, foreman: "羅玉軒", name: "邱冠英", site: "村田機械", zone: "6S整理整頓", hours, note });
                logs.push({ date, foreman: "羅玉軒", name: "郭怡蘭", site: "村田機械", zone: "6S整理整頓", hours, note });
            });

            wanDates.forEach(date => {
                let hours = 8;
                let note = "正常工時";
                if (date === "2026-06-27") {
                    note = "週六基本工時";
                }
                logs.push({ date, foreman: "羅玉軒", name: "萬昱賢", site: "村田機械", zone: "6S整理整頓", hours, note });
            });

            return logs;
        })(),
        leaveDb: [],
        announcementHistory: [],
        accData: {
            company: { name:'日森精工有限公司', taxId:'62097937', type:'ltd', capital:500000, par:1000, shares:500, owner:'羅玉軒', founded:'2026-01-01', address:'台北市大安區信義路四段1號2樓', business:'機電工程' },
            shareholders: [
                { name: '羅玉軒', shares: 500, type: 'person', idno: 'A123456789' }
            ],
            balanceSheet: { cash:500000, prepaid:0, fixed:0, ap:0, loan:0, otherLiab:0, status: "已核定" }
        },
        accountsDb: [
            { empId: "admin", name: "羅玉軒", password: "admin123", role: "最高系統管理員 / 總裁", otpEnabled: true, authorizedModules: ["base_brand", "base_hr", "func_employee_cards", "func_work_dispatch", "func_attendance", "func_group_insurance", "func_internal_acc", "func_external_acc", "func_e_invoicing", "func_board_meeting", "func_line_hub", "func_billing_payroll", "base_permissions", "func_recruitment"] },
            { empId: "0937581112", name: "羅玉軒", password: "admin", role: "最高系統管理員 / 總裁", otpEnabled: true, authorizedModules: ["base_brand", "base_hr", "func_employee_cards", "func_work_dispatch", "func_attendance", "func_group_insurance", "func_internal_acc", "func_external_acc", "func_e_invoicing", "func_board_meeting", "func_line_hub", "func_billing_payroll", "base_permissions", "func_recruitment"] },
            { empId: "邱冠英", name: "邱冠英", password: "emp", role: "現場同仁 / 領隊", authorizedModules: ["base_hr", "func_attendance", "func_line_hub"] },
            { empId: "郭怡蘭", name: "郭怡蘭", password: "emp", role: "現場同仁 / 領隊", authorizedModules: ["base_hr", "func_attendance", "func_line_hub"] },
            { empId: "萬昱賢", name: "萬昱賢", password: "emp", role: "現場同仁 / 領隊", authorizedModules: ["base_hr", "func_attendance", "func_line_hub"] }
        ],
        cardsDb: {
            "郭怡蘭": { enabled: true, title: "工種:6S / 承攬夥伴", phone: "0912-345-002", address: "彰化縣" },
            "邱冠英": { enabled: true, title: "工種:6S / 核心幹部", phone: "0912-345-001", address: "台中市" },
            "萬昱賢": { enabled: true, title: "工種:6S / 承攬夥伴", phone: "0912-345-003", address: "台中市" }
        },
        insurancesDb: {
            "郭怡蘭": { status: "basic", increasedAmount: 0, history: [
                { date: "2026-06-12", type: "基本保險加保", status: "已完成" }
            ]},
            "邱冠英": { status: "increased", increasedAmount: 3000000, history: [
                { date: "2026-06-12", type: "基本保險加保", status: "已完成" },
                { date: "2026-06-15", type: "增額保險加保 (300萬)", status: "已完成" }
            ]},
            "萬昱賢": { status: "none", increasedAmount: 0, history: [] }
        },
        invoicesDb: [
            { invoiceNo: "AB-87654321", date: "2026-06-16", customerName: "台積電", taxId: "24436181", amount: 150000, tax: 7500, status: "valid", period: "115年 05-06月", taxType: "taxable", format: "three-way", items: [
                { name: "拉線與軌道工程款", price: 150000, qty: 1 }
            ]}
        ],
        intentDb: [
            { name: "郭怡蘭", phone: "0912-345-002", step: "completed", idno: "N223456789", bankNo: "013", bankAcct: "123456789012", signDate: "2026-06-12", status: "已核准" },
            { name: "邱冠英", phone: "0912-345-001", step: "completed", idno: "B123456789", bankNo: "700", bankAcct: "123456789012", signDate: "2026-06-12", status: "已核准" },
            { name: "萬昱賢", phone: "0912-345-003", step: "signed", idno: "L123456789", bankNo: "007", bankAcct: "123456789012", signDate: "2026-06-15", status: "已核准" }
        ],
        qaDb: [
            { question: "請假手續與考評扣除規定", keyword: "請假", answer: "請假規定：同仁請假應提前於一日前下午18:00前，由LINE或系統提交假單；若臨時生病/突發狀況需於當天早上07:30前告知。未提供合格證明之請假，將扣除當月考評分數及全勤津貼累計天數。" },
            { question: "現場同仁基本薪資與加班計費", keyword: "薪資", answer: "計薪說明：本公司依工日核薪。平日正常工時8小時。平日延長工時(超時)以1.5倍計算超時津貼。擔任現場領隊者，每日額外發放領導加給。當月出勤達22天以上且無缺勤紀錄者，發放全勤津貼3,000元。" },
            { question: "安全防護具與防墜設施規定", keyword: "安全帽", answer: "安全規定：進入工地廠區必須全程正確佩戴符合CNS國家標準之安全帽、防滑工作鞋及高能見度反光背心。高處作業(2公尺以上)必須確實掛妥雙掛勾安全帶，違規者將面臨罰款與停工處分。" },
            { question: "出勤打卡與無故曠工處分", keyword: "出勤", answer: "出勤規定：每日早上08:00前需於LINE模擬器或打卡處完成打卡。無故不按時出勤且未請假者，視為曠工；曠工一天扣除三天考評分數，連續曠工達三日者終止承攬關係。" },
            { question: "外包承攬同仁加保與工會投保指引", keyword: "加保", answer: "🤖 日森精工 | 外包承攬同仁加保指引\n\n親愛的 {使用者名稱} 您好：\n\n【工作屬性符合說明】\n依據法規與雙方簽訂之承攬契約，外包承攬同仁依法不具備公司投保勞健保身分，需透過職業工會以「自營作業者」身分進行加保，以確保您的個人權益與現場工安保障。\n\n【工會收費方式與投保說明】\n工會保費為「按季繳納」，基本計費公式如下：\n• 勞保費/月 = 投保薪資 × 11% × 60%\n• 健保費/月 = 投保薪資 × 6% × 60% (目前定額)\n• 互助金與會費：依工會規定另計\n\n【每期應繳金額試算】\n若以最低投保薪資 29,500 元計算：\n• 勞保費：約 $1,617 / 月\n• 健保費：約 $852 / 月\n• 季繳合計 (3個月)：預估約 $7,407 起 (內含入會費與經常會費)\n\n【輕鬆加入工會 3 步驟】\n1️⃣ 下載並填寫\n請下載空白入會申請書並填妥資訊。\n👉【貼心填寫範例對照】(PDF)\nhttps://himori-portal-650268834354.asia-east1.run.app/勞動力工會-入會申請書11501_範例.pdf\n\n2️⃣ 準備資料與拍照\n準備身分證正反面影本、存摺封面影本，並與填妥的申請書一同拍照。\n\n3️⃣ LINE 線上送件\n將照片傳送至工會官方 LINE 帳號，即有專人為您辦理入會與加保。\n\n──────────────────────\n【工會黃金導流傳送門】\n──────────────────────\n🌐 工會官方主網頁\nhttps://www.yes3391699.tw/page/26\n\n📄 空白入會申請書下載 (PDF)\nhttps://himori-portal-650268834354.asia-east1.run.app/勞動力工會-入會申請書11501.pdf\n\n💬 工會官方 LINE 平台 (ID: @yes3391699)\nhttps://line.me/R/ti/p/%40yes3391699\n\n如有任何投保疑義，請隨時於此對話框留訊息，系統管理員將會為您即時處理。\n日森精工 關心您！" }
        ],
        vouchersDb: [
            { id: "VOU-001", type: "進項發票", no: "XY-98765432", desc: "工地購置接線端子與管線材料", amount: 12500, date: "2026-06-14", status: "已核銷", invoiceLink: "AB-87654321", verified: true, imageUrl: "" },
            { id: "VOU-002", type: "交通憑證", no: "HR-12345", desc: "高鐵出差車票-新竹廠勘", amount: 290, date: "2026-06-15", status: "已核銷", invoiceLink: "—", verified: true, imageUrl: "" }
        ],
        simulatedDate: "2026-06-16",
        subscribedModules: [
            "base_brand",
            "base_hr",
            "func_employee_cards",
            "func_work_dispatch",
            "func_attendance",
            "func_group_insurance",
            "func_internal_acc",
            "func_external_acc",
            "func_e_invoicing",
            "func_board_meeting",
            "func_line_hub",
            "base_permissions",
            "func_recruitment",
            "func_billing_payroll"
        ],
        companyConfig: { ...defaultCompanyConfig },
        unionConfig: {
            unionName: "桃園市勞動力援助職業工會",
            jobDescription: "依據法規與雙方簽訂之承攬契約，外包承攬同仁依法不具備公司投保勞健保身分，需透過職業工會以「自營作業者」身分進行加保，以確保您的個人權益與現場工安保障。",
            fees: [
                { item: "入會費", amount: 1000, cycle: "一次性" },
                { item: "經常會費", amount: 200, cycle: "每月" },
                { item: "繳費週期", amount: "按季", cycle: "季繳" }
            ],
            formula: {
                basicSalary: 29500,
                laborRate: 11,
                healthRate: 6,
                laborShare: 60,
                healthShare: 60
            },
            portals: {
                website: "https://www.yes3391699.tw/page/26",
                blankPdf: "https://himori-portal-650268834354.asia-east1.run.app/勞動力工會-入會申請書11501.pdf",
                lineLink: "https://line.me/R/ti/p/%40yes3391699",
                lineId: "@yes3391699"
            },
            sampleDocUrl: "https://himori-portal-650268834354.asia-east1.run.app/勞動力工會-入會申請書11501_範例.pdf"
        }
    };

    // 舊模組 ID 升級字典 (對舊 LocalStorage 資料進行向上相容)
    const moduleUpgradeMap = {
        // 原始名稱 -> 最新名稱
        "business_cards": "func_employee_cards",
        "hr_management": "func_work_dispatch",
        "attendance_management": "func_attendance",
        "accounting_finance": "func_internal_acc",
        "announcement_service": "func_line_hub",
        
        // 中間版名稱 -> 最新名稱
        "brand_identity": "base_brand",
        "hr_base": "base_hr",
        "employee_cards": "func_employee_cards",
        "work_dispatch": "func_work_dispatch",
        "attendance_mgmt": "func_attendance",
        "group_insurance": "func_group_insurance",
        "internal_accounting": "func_internal_acc",
        "external_accounting": "func_external_acc",
        "e_invoicing": "func_e_invoicing",
        "board_meeting": "func_board_meeting",
        "line_hub": "func_line_hub",
        "permissions": "base_permissions"
    };

    // 數據管理物件
    const HimoriDb = {
        params: {},
        tradesDb: {},
        employeeDb: {},
        rosterDb: [],
        attendanceLogs: [],
        leaveDb: [],
        announcementHistory: [],
        accData: {},
        accountsDb: [],
        cardsDb: {},
        insurancesDb: {},
        invoicesDb: [],
        intentDb: [],
        qaDb: [],
        vouchersDb: [],
        simulatedDate: "2026-06-16",
        alarmState: "",
        webhookReminderUrl: "",
        webhookAnnouncementUrl: "",
        subscribedModules: [],
        companyConfig: {},
        unionConfig: {},

        // 載入資料庫
        load() {
            try {
                // 基本防呆與自動初始化
                if (!localStorage.getItem("森精工_db_initialized_v8") || !localStorage.getItem("employeeDb") || !JSON.parse(localStorage.getItem("employeeDb"))["邱冠英"]) {
                    this.reset();
                    return;
                }

                this.params = JSON.parse(localStorage.getItem("params")) || defaults.params;
                this.tradesDb = JSON.parse(localStorage.getItem("tradesDb")) || defaults.tradesDb;
                this.employeeDb = JSON.parse(localStorage.getItem("employeeDb")) || defaults.employeeDb;
                this.rosterDb = JSON.parse(localStorage.getItem("rosterDb")) || defaults.rosterDb;
                this.attendanceLogs = JSON.parse(localStorage.getItem("attendanceLogs")) || defaults.attendanceLogs;
                this.leaveDb = JSON.parse(localStorage.getItem("leaveDb")) || defaults.leaveDb;
                this.announcementHistory = JSON.parse(localStorage.getItem("announcementHistory")) || defaults.announcementHistory;
                this.accData = JSON.parse(localStorage.getItem("acc_data")) || defaults.accData;
                
                // 讀取並轉換 accountsDb 確保模組 ID 相容
                let accounts = JSON.parse(localStorage.getItem("accountsDb")) || defaults.accountsDb;
                accounts.forEach(acc => {
                    if (acc.authorizedModules) {
                        acc.authorizedModules = acc.authorizedModules.map(modId => {
                            return moduleUpgradeMap[modId] || modId;
                        });
                        // 確保基礎一般類模組 base_hr 與 base_brand 自動包含
                        if (!acc.authorizedModules.includes("base_hr")) acc.authorizedModules.push("base_hr");
                    }
                });
                this.accountsDb = accounts;

                this.cardsDb = JSON.parse(localStorage.getItem("cardsDb")) || defaults.cardsDb;
                this.insurancesDb = JSON.parse(localStorage.getItem("insurancesDb")) || defaults.insurancesDb;
                this.invoicesDb = JSON.parse(localStorage.getItem("invoicesDb")) || defaults.invoicesDb;
                this.intentDb = JSON.parse(localStorage.getItem("intentDb")) || defaults.intentDb;
                this.qaDb = JSON.parse(localStorage.getItem("qaDb")) || defaults.qaDb;
                this.vouchersDb = JSON.parse(localStorage.getItem("vouchersDb")) || defaults.vouchersDb;
                this.simulatedDate = localStorage.getItem("simulated_date") || defaults.simulatedDate;
                this.alarmState = localStorage.getItem("alarm_state") || "";
                this.webhookReminderUrl = localStorage.getItem("webhook_reminder_url") || "";
                this.webhookAnnouncementUrl = localStorage.getItem("webhook_announcement_url") || "";
                
                // 讀取訂閱模組與公司配置
                let subscribed = JSON.parse(localStorage.getItem("subscribedModules")) || defaults.subscribedModules;
                this.subscribedModules = subscribed.map(modId => {
                    return moduleUpgradeMap[modId] || modId;
                });
                this.companyConfig = JSON.parse(localStorage.getItem("companyConfig")) || defaults.companyConfig;
                if (this.companyConfig && !this.companyConfig.modulesVersionTags) {
                    this.companyConfig.modulesVersionTags = { ...defaults.companyConfig.modulesVersionTags };
                }
                this.unionConfig = JSON.parse(localStorage.getItem("unionConfig")) || defaults.unionConfig;

            } catch (e) {
                console.error("載入資料庫失敗，自動重設...", e);
                this.reset();
            }
        },

        // 儲存資料庫
        save() {
            localStorage.setItem("params", JSON.stringify(this.params));
            localStorage.setItem("tradesDb", JSON.stringify(this.tradesDb));
            localStorage.setItem("employeeDb", JSON.stringify(this.employeeDb));
            localStorage.setItem("rosterDb", JSON.stringify(this.rosterDb));
            localStorage.setItem("attendanceLogs", JSON.stringify(this.attendanceLogs));
            localStorage.setItem("leaveDb", JSON.stringify(this.leaveDb));
            localStorage.setItem("announcementHistory", JSON.stringify(this.announcementHistory));
            localStorage.setItem("acc_data", JSON.stringify(this.accData));
            localStorage.setItem("accountsDb", JSON.stringify(this.accountsDb));
            localStorage.setItem("cardsDb", JSON.stringify(this.cardsDb));
            localStorage.setItem("insurancesDb", JSON.stringify(this.insurancesDb));
            localStorage.setItem("invoicesDb", JSON.stringify(this.invoicesDb));
            localStorage.setItem("intentDb", JSON.stringify(this.intentDb));
            localStorage.setItem("qaDb", JSON.stringify(this.qaDb));
            localStorage.setItem("vouchersDb", JSON.stringify(this.vouchersDb));
            localStorage.setItem("simulated_date", this.simulatedDate);
            localStorage.setItem("alarm_state", this.alarmState);
            localStorage.setItem("webhook_reminder_url", this.webhookReminderUrl);
            localStorage.setItem("webhook_announcement_url", this.webhookAnnouncementUrl);
            
            // 儲存訂閱模組與公司配置
            localStorage.setItem("subscribedModules", JSON.stringify(this.subscribedModules));
            localStorage.setItem("companyConfig", JSON.stringify(this.companyConfig));
            localStorage.setItem("unionConfig", JSON.stringify(this.unionConfig));
            
            // 觸發自訂事件，讓同視窗的其他 iframe 得知更新
            const event = new CustomEvent("himori_db_updated");
            window.dispatchEvent(event);
            if (window.parent && window.parent !== window) {
                window.parent.dispatchEvent(event);
            }
        },

        // 重設資料庫
        reset() {
            localStorage.clear();
            this.params = { ...defaults.params };
            this.tradesDb = { ...defaults.tradesDb };
            this.employeeDb = { ...defaults.employeeDb };
            this.rosterDb = [ ...defaults.rosterDb ];
            this.attendanceLogs = [ ...defaults.attendanceLogs ];
            this.leaveDb = [ ...defaults.leaveDb ];
            this.announcementHistory = [ ...defaults.announcementHistory ];
            this.accData = { ...defaults.accData };
            this.accountsDb = [ ...defaults.accountsDb ];
            this.cardsDb = { ...defaults.cardsDb };
            this.insurancesDb = { ...defaults.insurancesDb };
            this.invoicesDb = [ ...defaults.invoicesDb ];
            this.intentDb = [ ...defaults.intentDb ];
            this.qaDb = [ ...defaults.qaDb ];
            this.vouchersDb = [ ...defaults.vouchersDb ];
            this.simulatedDate = defaults.simulatedDate;
            this.alarmState = "";
            this.webhookReminderUrl = "";
            this.webhookAnnouncementUrl = "";
            
            // 訂閱與公司配置重設
            this.subscribedModules = [ ...defaults.subscribedModules ];
            this.companyConfig = { ...defaults.companyConfig };
            this.unionConfig = { ...defaults.unionConfig };
            
            this.save();
            localStorage.setItem("森精工_db_initialized_v8", "true");
        }
    };

    // 初始化載入
    HimoriDb.load();

    // 暴露全域變數
    global.HimoriModules = HimoriModules;
    global.HimoriDb = HimoriDb;
    
    // 將公司 Config 動態映射至全域，方便直接呼叫
    Object.defineProperty(global, 'HimoriCompanyConfig', {
        get: function() {
            return HimoriDb.companyConfig;
        },
        configurable: true
    });
    
    // 綁定 window 儲存異動事件監聽（供跨視窗同步）
    window.addEventListener("storage", function(e) {
        HimoriDb.load();
        const event = new CustomEvent("himori_db_updated");
        window.dispatchEvent(event);
    });

})(typeof window !== "undefined" ? window : global);
