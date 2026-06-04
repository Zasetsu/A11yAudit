export type Locale = "tr" | "en";

export interface Messages {
  // common
  "common.newScan": string;
  "common.startScan": string;
  "common.starting": string;
  "common.runScan": string;
  "common.cancel": string;
  "common.download": string;
  "common.copy": string;
  "common.remove": string;
  "common.open": string;
  "common.loading": string;
  "common.notAvailable": string;
  "common.notCaptured": string;
  "common.pending": string;
  "common.none": string;
  // nav
  "nav.overview": string;
  "nav.projects": string;
  "nav.newScan": string;
  "nav.scanRuns": string;
  "nav.findings": string;
  "nav.reports": string;
  "nav.settings": string;
  "nav.docs": string;
  "nav.members": string;
  "nav.configure": string;
  // shell
  "shell.switchProject": string;
  "shell.switchWorkspace": string;
  "shell.searchLabel": string;
  "shell.searchPlaceholder": string;
  "shell.switchThemeDark": string;
  "shell.switchThemeLight": string;
  "shell.signOut": string;
  "shell.language": string;
  "shell.primaryNav": string;
  // app / docs
  "app.mainContent": string;
  "app.demoBanner": string;
  "app.preparingSession": string;
  "docs.subtitle": string;
  "docs.mvpScope": string;
  "docs.scopeBody": string;
  "docs.bullet1": string;
  "docs.bullet2": string;
  "docs.bullet3": string;
  "docs.bullet4": string;
  // overview
  "overview.latestPdf": string;
  "overview.accessibilityScore": string;
  "overview.scoreHint": string;
  "overview.scoreDisclaimer": string;
  "overview.uniqueIssues": string;
  "overview.groupedProblems": string;
  "overview.affectedPages": string;
  "overview.sampledFromIssues": string;
  "overview.occurrences": string;
  "overview.rawDetections": string;
  "overview.criticalIssues": string;
  "overview.highestSeverity": string;
  "overview.triage": string;
  "overview.issuesBySeverity": string;
  "overview.severityDistribution": string;
  "overview.viewportSplit": string;
  "overview.viewportHint": string;
  "overview.currentRun": string;
  "overview.noRunning": string;
  "overview.topRecurring": string;
  "overview.allRuns": string;
  "overview.recentRuns": string;
  "overview.manualScanInProgress": (runId: string) => string;
  // projects
  "projects.newProject": string;
  "projects.subtitle": string;
  "projects.uniqueIssues": string;
  "projects.reports": string;
  "projects.viewports": string;
  "projects.lastScan": string;
  "projects.modelTitle": string;
  "projects.modelSub": string;
  "projects.modelBody": string;
  // new-scan
  "scan.subtitle": string;
  "scan.target": string;
  "scan.projectAction": string;
  "scan.projectActionHint": string;
  "scan.useExisting": string;
  "scan.createNew": string;
  "scan.project": string;
  "scan.projectHint": string;
  "scan.projectName": string;
  "scan.projectNameHint": string;
  "scan.projectNamePlaceholder": string;
  "scan.publicUrl": string;
  "scan.publicUrlHint": string;
  "scan.mode": string;
  "scan.modeHint": string;
  "scan.singleUrl": string;
  "scan.fullSite": string;
  "scan.maxPages": string;
  "scan.maxPagesHint": string;
  "scan.maxDepth": string;
  "scan.maxDepthHint": string;
  "scan.desktopViewport": string;
  "scan.desktopViewportHint": string;
  "scan.mobileViewport": string;
  "scan.mobileViewportHint": string;
  "scan.selectViewport": string;
  "scan.apiError": string;
  "scan.runProfile": string;
  "scan.scope": string;
  "scan.scopeCrawl": string;
  "scan.scopeSingle": string;
  "scan.limits": string;
  "scan.limitsValue": (maxPages: number, maxDepth: number) => string;
  "scan.onePage": string;
  "scan.viewports": string;
  "scan.authentication": string;
  "scan.authNotSupported": string;
  "scan.evidence": string;
  "scan.evidenceValue": string;
  "scan.reports": string;
  "scan.reportsValue": string;
  "scan.safetyNote": string;
  // scan-runs
  "runs.subtitle": string;
  "runs.runs": string;
  "runs.fullSite": string;
  "runs.singleUrl": string;
  "runs.profileMeta": (viewports: string, maxPages: number, maxDepth: number) => string;
  "runs.pagesWord": string;
  "runs.failedAfter": string;
  // scan-run detail
  "run.back": string;
  "run.notFound": string;
  "run.summary": string;
  "run.mode": string;
  "run.score": string;
  "run.error": string;
  "run.relatedIssues": string;
  "run.relatedReports": string;
  "run.noIssues": string;
  "run.noReports": string;
  "run.sinceLastScan": string;
  "run.statusNew": string;
  "run.statusOngoing": string;
  "run.statusResolved": string;
  "run.resolvedGroup": string;
  "run.viewDetail": (runId: string) => string;
  // findings
  "findings.subtitle": string;
  "findings.markResolved": string;
  "findings.markResolvedDisabled": string;
  "findings.issueGroups": string;
  "findings.csvDisabled": string;
  "findings.allSeverities": string;
  "findings.empty": string;
  // finding-detail
  "finding.back": string;
  "finding.summary": string;
  "finding.ruleId": string;
  "finding.affectedPages": string;
  "finding.occurrences": string;
  "finding.likelyScope": string;
  "finding.componentArea": string;
  "finding.cmsHint": string;
  "finding.confidence": string;
  "finding.representativeUrl": string;
  "finding.representativeSelector": string;
  "finding.sampleUrls": string;
  "finding.sampleUrlsHint": string;
  "finding.sampleUrlsEmpty": string;
  "finding.recommendation": string;
  "finding.htmlSnippet": string;
  "finding.evidencePageScreenshot": string;
  "finding.evidenceHtmlSnippet": string;
  "finding.confidenceHigh": string;
  "finding.confidenceMedium": string;
  "finding.confidenceLow": string;
  "finding.notFound": string;
  "finding.evidence": string;
  "finding.pageUrl": string;
  "finding.selector": string;
  "finding.instances": string;
  "finding.ruleDocs": string;
  "finding.capturedArtifacts": string;
  "finding.capturedArtifactsHint": string;
  "finding.noArtifacts": string;
  "finding.screenshotAlt": (title: string) => string;
  "finding.workflow": string;
  "finding.workflow1": string;
  "finding.workflow2": string;
  "finding.workflow3": string;
  "finding.workflowNote": string;
  "finding.openScreenshot": string;
  // reports
  "reports.subtitle": string;
  "reports.artifacts": string;
  "reports.csvNote": string;
  "reports.reportName": (kind: string) => string;
  "reports.downloadTitle": (kind: string) => string;
  "reports.generatingTitle": (kind: string) => string;
  "reports.generating": string;
  // members
  "members.workspaceMembership": string;
  "members.ownerRequired": string;
  "members.ownerRequiredBody": string;
  "members.manage": string;
  "members.invite": string;
  "members.sendInvite": string;
  "members.inviteOnce": string;
  "members.roleFor": (email: string) => string;
  "members.roleOwner": string;
  "members.roleMember": string;
  "members.pending": string;
  "members.pendingEmpty": string;
  "members.regenerate": string;
  "members.revoke": string;
  "members.emailPlaceholder": string;
  // settings
  "settings.subtitle": string;
  "settings.scanDefaults": string;
  "settings.defaultUrl": string;
  "settings.crawlLimit": string;
  "settings.reportFormat": string;
  "settings.reportFormatValue": string;
  "settings.artifactOutput": string;
  "settings.artifactOutputValue": string;
  "settings.evidenceRetention": string;
  "settings.storeSnippets": string;
  "settings.storeSnippetsHint": string;
  "settings.storeScreenshots": string;
  "settings.storeScreenshotsHint": string;
  "settings.authStorage": string;
  "settings.authStorageHint": string;
  "settings.storageNote": string;
  // auth (login/signup/invite)
  "auth.signIn": string;
  "auth.signInSubtitle": string;
  "auth.account": string;
  "auth.accountDetails": string;
  "auth.email": string;
  "auth.password": string;
  "auth.fullName": string;
  "auth.workspaceName": string;
  "auth.createAccount": string;
  "auth.createSubtitle": string;
  "auth.acceptInvite": string;
  "auth.acceptSubtitle": string;
  "auth.signInFailed": string;
  "auth.signupFailed": string;
  "auth.inviteFailed": string;
  "auth.noAccount": string;
  "auth.haveAccount": string;
  // workspaces
  "workspaces.title": string;
  "workspaces.subtitle": string;
  "workspaces.your": string;
  "workspaces.empty": string;
  // shared table headers
  "table.run": string;
  "table.project": string;
  "table.status": string;
  "table.profile": string;
  "table.target": string;
  "table.progress": string;
  "table.occurrences": string;
  "table.started": string;
  "table.severity": string;
  "table.issue": string;
  "table.wcag": string;
  "table.likelyScope": string;
  "table.component": string;
  "table.cmsHint": string;
  "table.pages": string;
  "table.report": string;
  "table.scan": string;
  "table.size": string;
  "table.created": string;
  "table.action": string;
  "table.name": string;
  "table.email": string;
  "table.role": string;
  "table.actions": string;
  "table.expires": string;
  // viewport
  "viewport.desktop": string;
  "viewport.mobile": string;
  "viewport.both": string;
  // severity
  "severity.critical": string;
  "severity.serious": string;
  "severity.moderate": string;
  "severity.minor": string;
  // status (finding)
  "status.new": string;
  "status.ongoing": string;
  "status.resolved": string;
  // status (run)
  "status.queued": string;
  "status.crawling": string;
  "status.auditing": string;
  "status.reporting": string;
  "status.completed": string;
  "status.failed": string;
}

export const LOCALES: Locale[] = ["tr", "en"];
export const DEFAULT_LOCALE: Locale = "tr";

export const MESSAGES: Record<Locale, Messages> = {
  tr: {
    "common.newScan": "Yeni Tarama",
    "common.startScan": "Taramayı Başlat",
    "common.starting": "Başlatılıyor...",
    "common.runScan": "Tarama Çalıştır",
    "common.cancel": "İptal",
    "common.download": "İndir",
    "common.copy": "Kopyala",
    "common.remove": "Kaldır",
    "common.open": "Aç",
    "common.loading": "Yükleniyor",
    "common.notAvailable": "Mevcut değil",
    "common.notCaptured": "Yakalanmadı",
    "common.pending": "Bekliyor",
    "common.none": "Seçilmedi",
    "nav.overview": "Genel Bakış",
    "nav.projects": "Projeler",
    "nav.newScan": "Yeni Tarama",
    "nav.scanRuns": "Taramalar",
    "nav.findings": "Bulgular",
    "nav.reports": "Raporlar",
    "nav.settings": "Ayarlar",
    "nav.docs": "Dokümantasyon",
    "nav.members": "Üyeler",
    "nav.configure": "Yapılandırma",
    "shell.switchProject": "Proje değiştir",
    "shell.switchWorkspace": "Çalışma alanı değiştir",
    "shell.searchLabel": "Bulgu, URL ve WCAG kriteri ara",
    "shell.searchPlaceholder": "Bulgu, URL, WCAG kriteri ara...",
    "shell.switchThemeDark": "Koyu temaya geç",
    "shell.switchThemeLight": "Açık temaya geç",
    "shell.signOut": "Çıkış yap",
    "shell.language": "Dil",
    "shell.primaryNav": "Birincil",
    "app.mainContent": "Ana içerik",
    "app.demoBanner": "API verisi kullanılamıyor, arayüz yerel demo verisi gösteriyor.",
    "app.preparingSession": "Oturumunuz hazırlanıyor.",
    "docs.subtitle": "Audera için operatör notları.",
    "docs.mvpScope": "Kapsam",
    "docs.scopeBody": "Audera yalnızca herkese açık HTTP ve HTTPS hedeflerini tarar. Kimlik doğrulamalı taramalar, zamanlanmış taramalar, CSV dışa aktarımı ve çözüldü-durumu akışları şu anda kapsam dışındadır.",
    "docs.bullet1": "Herkese açık bir web sitesi projesi oluşturun veya seçin.",
    "docs.bullet2": "Maksimum sayfa, maksimum derinlik, masaüstü ve mobil kontrolleriyle tek URL taraması ya da aynı-alan taraması çalıştırın.",
    "docs.bullet3": "WCAG kriteri, önem, görünüm, seçici, ekran görüntüsü ve snippet kanıtına göre gruplanmış bulguları inceleyin.",
    "docs.bullet4": "Tamamlanan taramalardan HTML ve PDF rapor çıktılarını indirin.",
    "overview.latestPdf": "Son PDF",
    "overview.accessibilityScore": "Erişilebilirlik puanı",
    "overview.scoreHint": "Denetlenen herkese açık URL'ler, masaüstü ve mobil kontroller üzerinden ağırlıklı puan.",
    "overview.scoreDisclaimer": "Otomatik kontroller yasal uyumluluğu belgelemez.",
    "overview.uniqueIssues": "Benzersiz sorunlar",
    "overview.groupedProblems": "gruplanmış sorunlar",
    "overview.affectedPages": "Etkilenen sayfalar",
    "overview.sampledFromIssues": "sorunlardan örneklenen",
    "overview.occurrences": "Tekrarlar",
    "overview.rawDetections": "ham tespitler",
    "overview.criticalIssues": "Kritik sorunlar",
    "overview.highestSeverity": "en yüksek önem",
    "overview.triage": "Önceliklendirme",
    "overview.issuesBySeverity": "Öneme göre sorunlar",
    "overview.severityDistribution": "Önem dağılımı",
    "overview.viewportSplit": "Görünüm dağılımı",
    "overview.viewportHint": "Mobil kontroller daha fazla hedef boyutu ve yeniden akış sorununu ortaya çıkarır.",
    "overview.currentRun": "Mevcut tarama",
    "overview.noRunning": "Bu proje için şu anda çalışan tarama yok.",
    "overview.topRecurring": "En sık tekrarlayan sorunlar",
    "overview.allRuns": "Tüm taramalar",
    "overview.recentRuns": "Son taramalar",
    "overview.manualScanInProgress": (runId) => `Manuel tarama sürüyor: ${runId}`,
    "projects.newProject": "Yeni Proje",
    "projects.subtitle": "Audera taramaları için yapılandırılmış herkese açık siteler.",
    "projects.uniqueIssues": "benzersiz sorun",
    "projects.reports": "rapor",
    "projects.viewports": "görünüm",
    "projects.lastScan": "Son tarama ",
    "projects.modelTitle": "Proje modeli",
    "projects.modelSub": "Proje hedefleri Audera'da saklanır.",
    "projects.modelBody": "Projeler, herkese açık HTTP veya HTTPS hedefleri için tutulan kayıtlardır. Kiracı hesapları, faturalandırma birimleri veya abonelikler değildir.",
    "scan.subtitle": "Herkese açık bir web sitesi projesi oluşturun ve CLI'de bulunan aynı tarama profilini çalıştırın.",
    "scan.target": "Tarama hedefi",
    "scan.projectAction": "Proje işlemi",
    "scan.projectActionHint": "Mevcut bir projeyi kullanın ya da bu hedeften yeni bir proje oluşturun.",
    "scan.useExisting": "Mevcut projeyi kullan",
    "scan.createNew": "Yeni proje oluştur",
    "scan.project": "Proje",
    "scan.projectHint": "Projeler, herkese açık siteler için yerel kayıtlardır.",
    "scan.projectName": "Proje adı",
    "scan.projectNameHint": "İsteğe bağlı; varsayılan olarak hedef ana makine adı kullanılır.",
    "scan.projectNamePlaceholder": "Belediye portalı",
    "scan.publicUrl": "Herkese açık URL",
    "scan.publicUrlHint": "Kimlik doğrulamalı sayfalar, özel ağlar ve yerel dosya URL'leri engellenir.",
    "scan.mode": "Mod",
    "scan.modeHint": "Tek URL, CLI single-url ile eşleşir. Tüm site, tarama limitleriyle aynı-köken bağlantıları izler.",
    "scan.singleUrl": "Tek URL",
    "scan.fullSite": "Tüm site aynı-alan taraması",
    "scan.maxPages": "Maksimum sayfa",
    "scan.maxPagesHint": "CLI --max-pages",
    "scan.maxDepth": "Maksimum derinlik",
    "scan.maxDepthHint": "CLI --max-depth",
    "scan.desktopViewport": "Masaüstü görünüm",
    "scan.desktopViewportHint": "CLI varsayılan görünümü; --no-desktop gibi devre dışı bırakılabilir.",
    "scan.mobileViewport": "Mobil görünüm",
    "scan.mobileViewportHint": "CLI varsayılan görünümü; --no-mobile gibi devre dışı bırakılabilir.",
    "scan.selectViewport": "Taramayı başlatmadan önce en az bir görünüm seçin.",
    "scan.apiError": "API tarama isteğini kabul etmedi. Sunucunun çalıştığından ve URL'nin izinli olduğundan emin olun.",
    "scan.runProfile": "Çalıştırma profili",
    "scan.scope": "Kapsam",
    "scan.scopeCrawl": "Aynı-alan taraması",
    "scan.scopeSingle": "Tek herkese açık URL",
    "scan.limits": "Limitler",
    "scan.limitsValue": (maxPages, maxDepth) => `${maxPages} sayfa / derinlik ${maxDepth}`,
    "scan.onePage": "1 sayfa",
    "scan.viewports": "Görünümler",
    "scan.authentication": "Kimlik doğrulama",
    "scan.authNotSupported": "Desteklenmiyor",
    "scan.evidence": "Kanıt",
    "scan.evidenceValue": "Ekran görüntüsü + HTML snippet",
    "scan.reports": "Raporlar",
    "scan.reportsValue": "HTML ve PDF çıktıları",
    "scan.safetyNote": "Tüm site taramaları aynı-köken güvenliğine, tarama limitlerine ve robots.txt'ye uyar.",
    "runs.subtitle": "Manuel herkese açık URL taramaları.",
    "runs.runs": "Taramalar",
    "runs.fullSite": "Tüm site",
    "runs.singleUrl": "Tek URL",
    "runs.profileMeta": (viewports, maxPages, maxDepth) => `${viewports} · ${maxPages} sayfa · derinlik ${maxDepth}`,
    "runs.pagesWord": "sayfa",
    "runs.failedAfter": "Şu kadar sonra başarısız:",
    "run.back": "Taramalara dön",
    "run.notFound": "Tarama bulunamadı",
    "run.summary": "Tarama özeti",
    "run.mode": "Mod",
    "run.score": "Puan",
    "run.error": "Hata",
    "run.relatedIssues": "Bu taramanın sorunları",
    "run.relatedReports": "Bu taramanın raporları",
    "run.noIssues": "Bu tarama için gruplanmış sorun yok.",
    "run.noReports": "Bu tarama için rapor yok.",
    "run.sinceLastScan": "Geçen taramadan beri",
    "run.statusNew": "yeni",
    "run.statusOngoing": "devam eden",
    "run.statusResolved": "çözüldü",
    "run.resolvedGroup": "Çözülen sorunlar",
    "run.viewDetail": (runId) => `${runId} taramasının detayını gör`,
    "findings.subtitle": "WCAG referansları ve kanıt işaretçileriyle gruplanmış erişilebilirlik sorunları.",
    "findings.markResolved": "Çözüldü İşaretle",
    "findings.markResolvedDisabled": "Çözüldü işaretleme henüz kullanılamıyor",
    "findings.issueGroups": "Sorun grupları",
    "findings.csvDisabled": "CSV dışa aktarımı henüz kullanılamıyor.",
    "findings.allSeverities": "Tüm önem seviyeleri",
    "findings.empty": "Mevcut filtrelere uyan gruplanmış sorun yok.",
    "finding.back": "Bulgulara dön",
    "finding.summary": "Sorun özeti",
    "finding.ruleId": "Kural kimliği",
    "finding.affectedPages": "Etkilenen sayfalar",
    "finding.occurrences": "Tekrarlar",
    "finding.likelyScope": "Olası kapsam",
    "finding.componentArea": "Bileşen alanı",
    "finding.cmsHint": "CMS ipucu",
    "finding.confidence": "Güven",
    "finding.representativeUrl": "Temsili URL",
    "finding.representativeSelector": "Temsili seçici",
    "finding.sampleUrls": "Örnek URL'ler",
    "finding.sampleUrlsHint": "Gruplanmış sorundan örneklenen sayfalar.",
    "finding.sampleUrlsEmpty": "Bu gruplanmış sorun için örnek URL yakalanmadı.",
    "finding.recommendation": "Öneri",
    "finding.htmlSnippet": "HTML snippet",
    "finding.evidencePageScreenshot": "Sayfa ekran görüntüsü",
    "finding.evidenceHtmlSnippet": "HTML snippet",
    "finding.confidenceHigh": "Yüksek güven",
    "finding.confidenceMedium": "Orta güven",
    "finding.confidenceLow": "Düşük güven",
    "finding.notFound": "Bulgu bulunamadı",
    "finding.evidence": "Bulgu kanıtı",
    "finding.pageUrl": "Sayfa URL'si",
    "finding.selector": "Seçici",
    "finding.instances": "Örnekler",
    "finding.ruleDocs": "Kural dokümantasyonu",
    "finding.capturedArtifacts": "Yakalanan çıktılar",
    "finding.capturedArtifactsHint": "Ekran görüntüleri ve snippet'ler bulgu başına saklanır.",
    "finding.noArtifacts": "Bu bulgu için ekran görüntüsü veya snippet çıktısı yakalanmadı.",
    "finding.screenshotAlt": (title) => `${title} ekran görüntüsü kanıtı`,
    "finding.workflow": "Önerilen iş akışı",
    "finding.workflow1": "Etkilenen bileşeni klavye ve ekran okuyucu akışlarında doğrulayın.",
    "finding.workflow2": "Tek tek üretilen sayfaları değil, kaynak deseni düzeltin.",
    "finding.workflow3": "Düzeltmeyi yayınladıktan sonra herkese açık bir URL taraması yeniden çalıştırın.",
    "finding.workflowNote": "Bulguları çözüldü olarak işaretleme, backend durum desteği gelene kadar bilinçli olarak devre dışıdır.",
    "finding.openScreenshot": "Ekran görüntüsünü aç",
    "reports.subtitle": "Audera tarafından üretilen rapor çıktıları.",
    "reports.artifacts": "Rapor çıktıları",
    "reports.csvNote": "CSV dışa aktarımı henüz kullanılamıyor.",
    "reports.reportName": (kind) => `${kind.toUpperCase()} erişilebilirlik raporu`,
    "reports.downloadTitle": (kind) => `${kind} raporunu indir`,
    "reports.generatingTitle": (kind) => `${kind} raporu hâlâ üretiliyor`,
    "reports.generating": "Üretiliyor",
    "members.workspaceMembership": "Çalışma alanı üyeliği",
    "members.ownerRequired": "Sahip erişimi gerekli",
    "members.ownerRequiredBody": "Yalnızca çalışma alanı sahipleri üyeleri ve davetleri yönetebilir.",
    "members.manage": "Bu çalışma alanına kimlerin erişebileceğini yönetin",
    "members.invite": "Üye davet et",
    "members.sendInvite": "Davet gönder",
    "members.inviteOnce": "Davet bağlantısı (şimdi kopyalayın, bir kez gösterilir):",
    "members.roleFor": (email) => `${email} için rol`,
    "members.roleOwner": "sahip",
    "members.roleMember": "üye",
    "members.pending": "Bekleyen davetler",
    "members.pendingEmpty": "Bekleyen davet yok.",
    "members.regenerate": "Bağlantıyı yenile",
    "members.revoke": "İptal et",
    "members.emailPlaceholder": "ekibarkadasi@example.com",
    "settings.subtitle": "Audera ayarları ve kontrolleri.",
    "settings.scanDefaults": "Tarama varsayılanları",
    "settings.defaultUrl": "Varsayılan proje URL'si",
    "settings.crawlLimit": "Tarama limiti",
    "settings.reportFormat": "Rapor formatı",
    "settings.reportFormatValue": "HTML + PDF",
    "settings.artifactOutput": "Çıktı deposu",
    "settings.artifactOutputValue": "Yerel sunucu deposu",
    "settings.evidenceRetention": "Kanıt saklama",
    "settings.storeSnippets": "HTML snippet'leri sakla",
    "settings.storeSnippetsHint": "Teknik inceleme için seçici bağlamını korur.",
    "settings.storeScreenshots": "Ekran görüntülerini sakla",
    "settings.storeScreenshotsHint": "Bulgu olduğunda ekran görüntüleri bulgu detay sayfalarına eklenir.",
    "settings.authStorage": "Kimlik doğrulamalı tarama deposu",
    "settings.authStorageHint": "Bu sürümde desteklenmiyor.",
    "settings.storageNote": "CLI --out seçeneği yerel CLI deposuna karşılık gelir. Web arayüzü sunucu çıktı deposunu kullanır ve indirmeleri Raporlar ve Bulgu kanıtı üzerinden sunar.",
    "auth.signIn": "Giriş Yap",
    "auth.signInSubtitle": "Çalışma alanınıza giriş yapın.",
    "auth.account": "Hesap",
    "auth.accountDetails": "Hesap bilgileri",
    "auth.email": "E-posta",
    "auth.password": "Parola",
    "auth.fullName": "Ad Soyad",
    "auth.workspaceName": "Çalışma alanı adı",
    "auth.createAccount": "Hesap Oluştur",
    "auth.createSubtitle": "Bir hesap ve çalışma alanı oluşturun.",
    "auth.acceptInvite": "Daveti Kabul Et",
    "auth.acceptSubtitle": "Davetinizle bir çalışma alanına katılın.",
    "auth.signInFailed": "Giriş başarısız. E-postanızı ve parolanızı kontrol edin.",
    "auth.signupFailed": "Hesap oluşturma başarısız. Bilgileri kontrol edip tekrar deneyin.",
    "auth.inviteFailed": "Davet kabulü başarısız. Daveti kontrol edip tekrar deneyin.",
    "auth.noAccount": "Hesabınız yok mu?",
    "auth.haveAccount": "Zaten hesabınız var mı?",
    "workspaces.title": "Çalışma Alanları",
    "workspaces.subtitle": "Açmak istediğiniz çalışma alanını seçin.",
    "workspaces.your": "Çalışma alanlarınız",
    "workspaces.empty": "Bu hesap için kullanılabilir çalışma alanı yok.",
    "table.run": "Tarama",
    "table.project": "Proje",
    "table.status": "Durum",
    "table.profile": "Profil",
    "table.target": "Hedef",
    "table.progress": "İlerleme",
    "table.occurrences": "Tekrarlar",
    "table.started": "Başladı",
    "table.severity": "Önem",
    "table.issue": "Sorun",
    "table.wcag": "WCAG",
    "table.likelyScope": "Olası kapsam",
    "table.component": "Bileşen",
    "table.cmsHint": "CMS ipucu",
    "table.pages": "Sayfalar",
    "table.report": "Rapor",
    "table.scan": "Tarama",
    "table.size": "Boyut",
    "table.created": "Oluşturuldu",
    "table.action": "İşlem",
    "table.name": "Ad",
    "table.email": "E-posta",
    "table.role": "Rol",
    "table.actions": "İşlemler",
    "table.expires": "Sona eriyor",
    "viewport.desktop": "Masaüstü",
    "viewport.mobile": "Mobil",
    "viewport.both": "Her ikisi",
    "severity.critical": "Kritik",
    "severity.serious": "Ciddi",
    "severity.moderate": "Orta",
    "severity.minor": "Düşük",
    "status.new": "Yeni",
    "status.ongoing": "Devam eden",
    "status.resolved": "Çözüldü",
    "status.queued": "Sırada",
    "status.crawling": "Taranıyor",
    "status.auditing": "Denetleniyor",
    "status.reporting": "Raporlanıyor",
    "status.completed": "Tamamlandı",
    "status.failed": "Başarısız"
  },
  en: {
    "common.newScan": "New Scan",
    "common.startScan": "Start Scan",
    "common.starting": "Starting...",
    "common.runScan": "Run Scan",
    "common.cancel": "Cancel",
    "common.download": "Download",
    "common.copy": "Copy",
    "common.remove": "Remove",
    "common.open": "Open",
    "common.loading": "Loading",
    "common.notAvailable": "Not available",
    "common.notCaptured": "Not captured",
    "common.pending": "Pending",
    "common.none": "None selected",
    "nav.overview": "Overview",
    "nav.projects": "Projects",
    "nav.newScan": "New Scan",
    "nav.scanRuns": "Scan Runs",
    "nav.findings": "Findings",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.docs": "Documentation",
    "nav.members": "Members",
    "nav.configure": "Configure",
    "shell.switchProject": "Switch project",
    "shell.switchWorkspace": "Switch workspace",
    "shell.searchLabel": "Search findings, URLs, and WCAG criteria",
    "shell.searchPlaceholder": "Search findings, URLs, WCAG criteria...",
    "shell.switchThemeDark": "Switch to dark theme",
    "shell.switchThemeLight": "Switch to light theme",
    "shell.signOut": "Sign out",
    "shell.language": "Language",
    "shell.primaryNav": "Primary",
    "app.mainContent": "Main content",
    "app.demoBanner": "API data is unavailable, so the interface is showing local demo data.",
    "app.preparingSession": "Preparing your session.",
    "docs.subtitle": "Operator notes for Audera.",
    "docs.mvpScope": "Scope",
    "docs.scopeBody": "Audera scans public HTTP and HTTPS targets only. Authenticated scans, scheduled scans, CSV exports, and resolved-state workflows are not yet available.",
    "docs.bullet1": "Create or select a public website project.",
    "docs.bullet2": "Run a single URL scan or a same-domain crawl with max page, max depth, desktop, and mobile controls.",
    "docs.bullet3": "Review findings grouped by WCAG criterion, severity, viewport, selector, screenshot, and snippet evidence.",
    "docs.bullet4": "Download HTML and PDF report artifacts from completed scans.",
    "overview.latestPdf": "Latest PDF",
    "overview.accessibilityScore": "Accessibility score",
    "overview.scoreHint": "Weighted score across audited public URLs, desktop checks, and mobile checks.",
    "overview.scoreDisclaimer": "Automated checks do not certify legal compliance.",
    "overview.uniqueIssues": "Unique issues",
    "overview.groupedProblems": "grouped problems",
    "overview.affectedPages": "Affected pages",
    "overview.sampledFromIssues": "sampled from issues",
    "overview.occurrences": "Occurrences",
    "overview.rawDetections": "raw detections",
    "overview.criticalIssues": "Critical issues",
    "overview.highestSeverity": "highest severity",
    "overview.triage": "Triage",
    "overview.issuesBySeverity": "Issues by severity",
    "overview.severityDistribution": "Severity distribution",
    "overview.viewportSplit": "Viewport split",
    "overview.viewportHint": "Mobile checks expose more target size and reflow issues.",
    "overview.currentRun": "Current run",
    "overview.noRunning": "No scan is currently running for this project.",
    "overview.topRecurring": "Top recurring issues",
    "overview.allRuns": "All runs",
    "overview.recentRuns": "Recent scan runs",
    "overview.manualScanInProgress": (runId) => `Manual scan in progress: ${runId}`,
    "projects.newProject": "New Project",
    "projects.subtitle": "Public websites configured for Audera scans.",
    "projects.uniqueIssues": "unique issues",
    "projects.reports": "reports",
    "projects.viewports": "viewports",
    "projects.lastScan": "Last scan ",
    "projects.modelTitle": "Project model",
    "projects.modelSub": "Project targets are stored in Audera.",
    "projects.modelBody": "Projects are records for public HTTP or HTTPS targets. They are not tenant accounts, billing entities, or subscriptions.",
    "scan.subtitle": "Create a public website project and run the same scan profile available in the CLI.",
    "scan.target": "Scan target",
    "scan.projectAction": "Project action",
    "scan.projectActionHint": "Use an existing project or create one from this target.",
    "scan.useExisting": "Use existing project",
    "scan.createNew": "Create new project",
    "scan.project": "Project",
    "scan.projectHint": "Projects are local records for public websites.",
    "scan.projectName": "Project name",
    "scan.projectNameHint": "Optional; defaults to the target hostname.",
    "scan.projectNamePlaceholder": "Municipal portal",
    "scan.publicUrl": "Public URL",
    "scan.publicUrlHint": "Authenticated pages, private networks, and local file URLs are blocked.",
    "scan.mode": "Mode",
    "scan.modeHint": "Single URL matches CLI single-url. Full site follows same-origin links with crawl limits.",
    "scan.singleUrl": "Single URL",
    "scan.fullSite": "Full site same-domain crawl",
    "scan.maxPages": "Max pages",
    "scan.maxPagesHint": "CLI --max-pages",
    "scan.maxDepth": "Max depth",
    "scan.maxDepthHint": "CLI --max-depth",
    "scan.desktopViewport": "Desktop viewport",
    "scan.desktopViewportHint": "CLI default viewport; can be disabled like --no-desktop.",
    "scan.mobileViewport": "Mobile viewport",
    "scan.mobileViewportHint": "CLI default viewport; can be disabled like --no-mobile.",
    "scan.selectViewport": "Select at least one viewport before starting a scan.",
    "scan.apiError": "The API did not accept the scan request. Check that the server is running and the URL is allowed.",
    "scan.runProfile": "Run profile",
    "scan.scope": "Scope",
    "scan.scopeCrawl": "Same-domain crawl",
    "scan.scopeSingle": "Single public URL",
    "scan.limits": "Limits",
    "scan.limitsValue": (maxPages, maxDepth) => `${maxPages} pages / depth ${maxDepth}`,
    "scan.onePage": "1 page",
    "scan.viewports": "Viewports",
    "scan.authentication": "Authentication",
    "scan.authNotSupported": "Not supported",
    "scan.evidence": "Evidence",
    "scan.evidenceValue": "Screenshot + HTML snippet",
    "scan.reports": "Reports",
    "scan.reportsValue": "HTML and PDF artifacts",
    "scan.safetyNote": "Full site scans obey same-origin safety, crawl limits, and robots.txt.",
    "runs.subtitle": "Manual public URL scan runs.",
    "runs.runs": "Runs",
    "runs.fullSite": "Full site",
    "runs.singleUrl": "Single URL",
    "runs.profileMeta": (viewports, maxPages, maxDepth) => `${viewports} · ${maxPages} pages · depth ${maxDepth}`,
    "runs.pagesWord": "pages",
    "runs.failedAfter": "Failed after",
    "run.back": "Back to scan runs",
    "run.notFound": "Scan run not found",
    "run.summary": "Scan summary",
    "run.mode": "Mode",
    "run.score": "Score",
    "run.error": "Error",
    "run.relatedIssues": "Issues from this scan",
    "run.relatedReports": "Reports from this scan",
    "run.noIssues": "No grouped issues for this scan.",
    "run.noReports": "No reports for this scan.",
    "run.sinceLastScan": "Since last scan",
    "run.statusNew": "new",
    "run.statusOngoing": "ongoing",
    "run.statusResolved": "resolved",
    "run.resolvedGroup": "Resolved issues",
    "run.viewDetail": (runId) => `View detail for scan ${runId}`,
    "findings.subtitle": "Grouped accessibility issues with WCAG references and evidence pointers.",
    "findings.markResolved": "Mark Resolved",
    "findings.markResolvedDisabled": "Mark Resolved is not yet available",
    "findings.issueGroups": "Issue groups",
    "findings.csvDisabled": "CSV export is not yet available.",
    "findings.allSeverities": "All severities",
    "findings.empty": "No grouped issues match the current filters.",
    "finding.back": "Back to Findings",
    "finding.summary": "Issue summary",
    "finding.ruleId": "Rule ID",
    "finding.affectedPages": "Affected pages",
    "finding.occurrences": "Occurrences",
    "finding.likelyScope": "Likely scope",
    "finding.componentArea": "Component area",
    "finding.cmsHint": "CMS hint",
    "finding.confidence": "Confidence",
    "finding.representativeUrl": "Representative URL",
    "finding.representativeSelector": "Representative selector",
    "finding.sampleUrls": "Sample URLs",
    "finding.sampleUrlsHint": "Sampled pages from the grouped issue.",
    "finding.sampleUrlsEmpty": "No sample URLs were captured for this grouped issue.",
    "finding.recommendation": "Recommendation",
    "finding.htmlSnippet": "HTML snippet",
    "finding.evidencePageScreenshot": "Page screenshot",
    "finding.evidenceHtmlSnippet": "HTML snippet",
    "finding.confidenceHigh": "High confidence",
    "finding.confidenceMedium": "Medium confidence",
    "finding.confidenceLow": "Low confidence",
    "finding.notFound": "Finding not found",
    "finding.evidence": "Finding evidence",
    "finding.pageUrl": "Page URL",
    "finding.selector": "Selector",
    "finding.instances": "Instances",
    "finding.ruleDocs": "Rule documentation",
    "finding.capturedArtifacts": "Captured artifacts",
    "finding.capturedArtifactsHint": "Screenshots and snippets are stored per finding.",
    "finding.noArtifacts": "No screenshot or snippet artifact was captured for this finding.",
    "finding.screenshotAlt": (title) => `${title} screenshot evidence`,
    "finding.workflow": "Recommended workflow",
    "finding.workflow1": "Verify the affected component in keyboard and screen reader flows.",
    "finding.workflow2": "Fix the source pattern, not individual generated pages.",
    "finding.workflow3": "Re-run a public URL scan after deploying the fix.",
    "finding.workflowNote": "Marking findings as resolved is intentionally disabled until backend state support exists.",
    "finding.openScreenshot": "Open screenshot",
    "reports.subtitle": "Report artifacts generated by Audera.",
    "reports.artifacts": "Report artifacts",
    "reports.csvNote": "CSV export is not yet available.",
    "reports.reportName": (kind) => `${kind.toUpperCase()} accessibility report`,
    "reports.downloadTitle": (kind) => `Download ${kind} report`,
    "reports.generatingTitle": (kind) => `${kind} report is still generating`,
    "reports.generating": "Generating",
    "members.workspaceMembership": "Workspace membership",
    "members.ownerRequired": "Owner access required",
    "members.ownerRequiredBody": "Only workspace owners can manage members and invitations.",
    "members.manage": "Manage who can access this workspace",
    "members.invite": "Invite a member",
    "members.sendInvite": "Send invite",
    "members.inviteOnce": "Invite link (copy now, it is shown once):",
    "members.roleFor": (email) => `Role for ${email}`,
    "members.roleOwner": "owner",
    "members.roleMember": "member",
    "members.pending": "Pending invitations",
    "members.pendingEmpty": "No pending invitations.",
    "members.regenerate": "Regenerate link",
    "members.revoke": "Revoke",
    "members.emailPlaceholder": "teammate@example.com",
    "settings.subtitle": "Audera settings and controls.",
    "settings.scanDefaults": "Scan defaults",
    "settings.defaultUrl": "Default project URL",
    "settings.crawlLimit": "Crawl limit",
    "settings.reportFormat": "Report format",
    "settings.reportFormatValue": "HTML + PDF",
    "settings.artifactOutput": "Artifact output",
    "settings.artifactOutputValue": "Local server storage",
    "settings.evidenceRetention": "Evidence retention",
    "settings.storeSnippets": "Store HTML snippets",
    "settings.storeSnippetsHint": "Keeps selector context for technical review.",
    "settings.storeScreenshots": "Store screenshots",
    "settings.storeScreenshotsHint": "Screenshots are attached to finding detail pages when findings exist.",
    "settings.authStorage": "Authenticated scan storage",
    "settings.authStorageHint": "Not supported in this version.",
    "settings.storageNote": "The CLI --out option maps to local CLI storage. The web UI uses the server artifact store and exposes downloads through Reports and Finding evidence.",
    "auth.signIn": "Sign in",
    "auth.signInSubtitle": "Sign in to your workspace.",
    "auth.account": "Account",
    "auth.accountDetails": "Account details",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.fullName": "Full name",
    "auth.workspaceName": "Workspace name",
    "auth.createAccount": "Create account",
    "auth.createSubtitle": "Create an account and workspace.",
    "auth.acceptInvite": "Accept invite",
    "auth.acceptSubtitle": "Join a workspace with your invitation.",
    "auth.signInFailed": "Sign in failed. Check your email and password.",
    "auth.signupFailed": "Account creation failed. Check the details and try again.",
    "auth.inviteFailed": "Invite acceptance failed. Check the invite and try again.",
    "auth.noAccount": "No account yet?",
    "auth.haveAccount": "Already have an account?",
    "workspaces.title": "Workspaces",
    "workspaces.subtitle": "Choose the workspace you want to open.",
    "workspaces.your": "Your workspaces",
    "workspaces.empty": "No workspaces are available for this account.",
    "table.run": "Run",
    "table.project": "Project",
    "table.status": "Status",
    "table.profile": "Profile",
    "table.target": "Target",
    "table.progress": "Progress",
    "table.occurrences": "Occurrences",
    "table.started": "Started",
    "table.severity": "Severity",
    "table.issue": "Issue",
    "table.wcag": "WCAG",
    "table.likelyScope": "Likely scope",
    "table.component": "Component",
    "table.cmsHint": "CMS hint",
    "table.pages": "Pages",
    "table.report": "Report",
    "table.scan": "Scan",
    "table.size": "Size",
    "table.created": "Created",
    "table.action": "Action",
    "table.name": "Name",
    "table.email": "Email",
    "table.role": "Role",
    "table.actions": "Actions",
    "table.expires": "Expires",
    "viewport.desktop": "Desktop",
    "viewport.mobile": "Mobile",
    "viewport.both": "Both",
    "severity.critical": "Critical",
    "severity.serious": "Serious",
    "severity.moderate": "Moderate",
    "severity.minor": "Minor",
    "status.new": "New",
    "status.ongoing": "Ongoing",
    "status.resolved": "Resolved",
    "status.queued": "Queued",
    "status.crawling": "Crawling",
    "status.auditing": "Auditing",
    "status.reporting": "Reporting",
    "status.completed": "Completed",
    "status.failed": "Failed"
  }
};
