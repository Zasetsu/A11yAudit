# Web UI Localization (TR/EN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the `apps/web` React UI to Turkish-by-default with a TR/EN top-bar switcher, using a typed in-house message catalog (no i18n library).

**Architecture:** A small `apps/web/src/i18n/` module: a typed bilingual catalog (`messages.ts`), a React context (`locale-context.tsx`) that persists the choice in `localStorage` and keeps `<html lang>` in sync, and a `useT()` hook. Every visible chrome string is replaced with `t("key")`. Axe finding text stays English; WCAG criterion *names* resolve via `@a11yaudit/core`.

**Tech Stack:** React 18, Vite, TypeScript (ESM, `.js` import extensions), Vitest + Testing Library (happy-dom). Reuse `ReportLocale` from `@a11yaudit/core`.

**Conventions:** ESM only; relative imports use explicit `.js` extensions even from `.ts`/`.tsx` (e.g. `./messages.js`). Run tests with `./node_modules/.bin/vitest` (pnpm is not on PATH). Typecheck a package with `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`.

---

## File Structure

**New files:**
- `apps/web/src/i18n/messages.ts` — `Locale` type, `Messages` interface, `MESSAGES` bilingual catalog, `DEFAULT_LOCALE`, `LOCALES`.
- `apps/web/src/i18n/messages.test.ts` — catalog key-parity test.
- `apps/web/src/i18n/locale-context.tsx` — `LocaleProvider`, `useT()`.
- `apps/web/src/i18n/locale-context.test.tsx` — provider/hook behavior.
- `apps/web/src/test-utils/render-with-locale.tsx` — test helper wrapping UI in `LocaleProvider`.

**Modified files:** `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/src/design/shell.tsx`, `apps/web/src/design/ui.tsx`, `apps/web/src/data.ts`, and pages: `app.tsx`, `overview.tsx`, `projects.tsx`, `new-scan.tsx`, `scan-runs.tsx`, `findings.tsx`, `finding-detail.tsx`, `reports.tsx`, `members.tsx`, `settings.tsx`, `login.tsx`, `signup.tsx`, `invite.tsx`, `workspaces.tsx`. Tests: `auth.test.tsx`, `members.test.tsx`, `findings.test.ts`, `reports.test.ts`, `scan-runs.test.ts`. Docs: `CLAUDE.md`.

**Key namespaces** (used throughout): `common.*`, `nav.*`, `shell.*`, `app.*`, `docs.*`, `overview.*`, `projects.*`, `scan.*` (new-scan), `runs.*` (scan-runs), `findings.*`, `finding.*` (detail), `reports.*`, `members.*`, `settings.*`, `auth.*`, `workspaces.*`, `table.*` (shared column headers), `viewport.*`, `severity.*`, `status.*` (finding + run).

---

## Task 1: Message catalog

**Files:**
- Create: `apps/web/src/i18n/messages.ts`
- Test: `apps/web/src/i18n/messages.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/i18n/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MESSAGES, LOCALES, DEFAULT_LOCALE } from "./messages.js";

describe("message catalog", () => {
  it("has identical key sets for every locale", () => {
    const trKeys = Object.keys(MESSAGES.tr).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it("has a non-empty value for every key in every locale", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        if (typeof value === "string") {
          expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
        } else {
          expect(typeof value, `${locale}.${key}`).toBe("function");
        }
      }
    }
  });

  it("defaults to Turkish", () => {
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(LOCALES).toEqual(["tr", "en"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/web/src/i18n/messages.test.ts`
Expected: FAIL — cannot resolve `./messages.js`.

- [ ] **Step 3: Write the catalog**

`apps/web/src/i18n/messages.ts` — the **complete** bilingual catalog. Function-valued entries are for strings with interpolation; `t("key")` returns the function, which the caller invokes.

```ts
import type { ReportLocale } from "@a11yaudit/core";

export type Locale = ReportLocale; // "tr" | "en"

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
  "shell.brandSub": string;
  "shell.selfHosted": string;
  "shell.localApi": string;
  "shell.switchProject": string;
  "shell.switchWorkspace": string;
  "shell.searchLabel": string;
  "shell.searchPlaceholder": string;
  "shell.switchThemeDark": string;
  "shell.switchThemeLight": string;
  "shell.repoNotConfigured": string;
  "shell.signOut": string;
  "shell.local": string;
  "shell.language": string;
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
  // reports
  "reports.subtitle": string;
  "reports.artifacts": string;
  "reports.csvNote": string;
  "reports.reportName": (kind: string) => string;
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
    "shell.brandSub": "WCAG 2.2 Konsolu",
    "shell.selfHosted": "Kendi sunucunuzda",
    "shell.localApi": "yerel API · v0.1.0",
    "shell.switchProject": "Proje değiştir",
    "shell.switchWorkspace": "Çalışma alanı değiştir",
    "shell.searchLabel": "Bulgu, URL ve WCAG kriteri ara",
    "shell.searchPlaceholder": "Bulgu, URL, WCAG kriteri ara...",
    "shell.switchThemeDark": "Koyu temaya geç",
    "shell.switchThemeLight": "Açık temaya geç",
    "shell.repoNotConfigured": "Depo bağlantısı yapılandırılmadı",
    "shell.signOut": "Çıkış yap",
    "shell.local": "Yerel",
    "shell.language": "Dil",
    "app.mainContent": "Ana içerik",
    "app.demoBanner": "API verisi kullanılamıyor, arayüz yerel demo verisi gösteriyor.",
    "app.preparingSession": "Oturumunuz hazırlanıyor.",
    "docs.subtitle": "Bu açık kaynak, kendi sunucunuzda barındırılan MVP için operatör notları.",
    "docs.mvpScope": "MVP kapsamı",
    "docs.scopeBody": "A11yAudit yalnızca herkese açık HTTP ve HTTPS hedeflerini tarar. Kimlik doğrulamalı taramalar, zamanlanmış taramalar, CSV dışa aktarımı ve çözüldü-durumu akışları bu MVP'nin dışındadır.",
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
    "projects.newProject": "Yeni Proje",
    "projects.subtitle": "Yerel A11yAudit taramaları için yapılandırılmış herkese açık siteler.",
    "projects.uniqueIssues": "benzersiz sorun",
    "projects.reports": "rapor",
    "projects.viewports": "görünüm",
    "projects.lastScan": "Son tarama ",
    "projects.modelTitle": "Proje modeli",
    "projects.modelSub": "MVP, proje hedeflerini yerel olarak saklar.",
    "projects.modelBody": "Projeler, herkese açık HTTP veya HTTPS hedefleri için kendi sunucunuzda tutulan kayıtlardır. Kiracı hesapları, faturalandırma birimleri veya abonelikler değildir.",
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
    "runs.subtitle": "Yerel örnekten manuel herkese açık URL taramaları.",
    "runs.runs": "Taramalar",
    "runs.fullSite": "Tüm site",
    "runs.singleUrl": "Tek URL",
    "runs.profileMeta": (viewports, maxPages, maxDepth) => `${viewports} · ${maxPages} sayfa · derinlik ${maxDepth}`,
    "findings.subtitle": "WCAG referansları ve kanıt işaretçileriyle gruplanmış erişilebilirlik sorunları.",
    "findings.markResolved": "Çözüldü İşaretle",
    "findings.markResolvedDisabled": "Çözüldü işaretleme MVP dışındadır",
    "findings.issueGroups": "Sorun grupları",
    "findings.csvDisabled": "CSV dışa aktarımı bu MVP'ye dahil değildir.",
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
    "reports.subtitle": "Yerel örnek tarafından üretilen rapor çıktıları.",
    "reports.artifacts": "Rapor çıktıları",
    "reports.csvNote": "CSV dışa aktarımı MVP'nin parçası değildir.",
    "reports.reportName": (kind) => `${kind.toUpperCase()} erişilebilirlik raporu`,
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
    "settings.subtitle": "Kendi sunucunuzda barındırılan MVP için yerel örnek kontrolleri.",
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
    "settings.authStorageHint": "MVP'de desteklenmiyor.",
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
    "shell.brandSub": "WCAG 2.2 Console",
    "shell.selfHosted": "Self-hosted instance",
    "shell.localApi": "local API · v0.1.0",
    "shell.switchProject": "Switch project",
    "shell.switchWorkspace": "Switch workspace",
    "shell.searchLabel": "Search findings, URLs, and WCAG criteria",
    "shell.searchPlaceholder": "Search findings, URLs, WCAG criteria...",
    "shell.switchThemeDark": "Switch to dark theme",
    "shell.switchThemeLight": "Switch to light theme",
    "shell.repoNotConfigured": "Repository link is not configured",
    "shell.signOut": "Sign out",
    "shell.local": "Local",
    "shell.language": "Language",
    "app.mainContent": "Main content",
    "app.demoBanner": "API data is unavailable, so the interface is showing local demo data.",
    "app.preparingSession": "Preparing your session.",
    "docs.subtitle": "Operator notes for this open-source, self-hosted MVP.",
    "docs.mvpScope": "MVP scope",
    "docs.scopeBody": "A11yAudit scans public HTTP and HTTPS targets only. Authenticated scans, scheduled scans, CSV exports, and resolved-state workflows are outside this MVP.",
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
    "projects.newProject": "New Project",
    "projects.subtitle": "Public websites configured for local A11yAudit scans.",
    "projects.uniqueIssues": "unique issues",
    "projects.reports": "reports",
    "projects.viewports": "viewports",
    "projects.lastScan": "Last scan ",
    "projects.modelTitle": "Project model",
    "projects.modelSub": "The MVP stores project targets locally.",
    "projects.modelBody": "Projects are self-hosted records for public HTTP or HTTPS targets. They are not tenant accounts, billing entities, or subscriptions.",
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
    "runs.subtitle": "Manual public URL scan runs from the local instance.",
    "runs.runs": "Runs",
    "runs.fullSite": "Full site",
    "runs.singleUrl": "Single URL",
    "runs.profileMeta": (viewports, maxPages, maxDepth) => `${viewports} · ${maxPages} pages · depth ${maxDepth}`,
    "findings.subtitle": "Grouped accessibility issues with WCAG references and evidence pointers.",
    "findings.markResolved": "Mark Resolved",
    "findings.markResolvedDisabled": "Mark Resolved is outside the MVP",
    "findings.issueGroups": "Issue groups",
    "findings.csvDisabled": "CSV export is not included in this MVP.",
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
    "reports.subtitle": "Report artifacts generated by the local instance.",
    "reports.artifacts": "Report artifacts",
    "reports.csvNote": "CSV export is not part of the MVP.",
    "reports.reportName": (kind) => `${kind.toUpperCase()} accessibility report`,
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
    "settings.subtitle": "Local instance controls for the self-hosted MVP.",
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
    "settings.authStorageHint": "Not supported in the MVP.",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/web/src/i18n/messages.test.ts`
Expected: PASS (3 tests). Also run `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/messages.ts apps/web/src/i18n/messages.test.ts
git commit -m "feat(web): bilingual message catalog (tr/en) for UI localization"
```

---

## Task 2: Locale context + useT hook

**Files:**
- Create: `apps/web/src/i18n/locale-context.tsx`
- Test: `apps/web/src/i18n/locale-context.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/i18n/locale-context.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, useT } from "./locale-context.js";

function mount(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<LocaleProvider>{ui}</LocaleProvider>); });
  return { container, root };
}

function Probe() {
  const { t, locale, setLocale } = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t("nav.overview")}</span>
      <button onClick={() => setLocale("en")}>en</button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.lang = ""; });

  it("defaults to Turkish when storage is empty", () => {
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("tr");
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Genel Bakış");
    expect(document.documentElement.lang).toBe("tr");
  });

  it("reads a stored locale", () => {
    localStorage.setItem("a11yaudit-locale", "en");
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Overview");
  });

  it("falls back to Turkish for an invalid stored value", () => {
    localStorage.setItem("a11yaudit-locale", "de");
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("tr");
  });

  it("setLocale updates output, storage, and <html lang>", () => {
    const { container } = mount(<Probe />);
    act(() => { container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Overview");
    expect(localStorage.getItem("a11yaudit-locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/web/src/i18n/locale-context.test.tsx`
Expected: FAIL — cannot resolve `./locale-context.js`.

- [ ] **Step 3: Implement the provider**

`apps/web/src/i18n/locale-context.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALES, MESSAGES, type Locale, type Messages } from "./messages.js";

const STORAGE_KEY = "a11yaudit-locale";

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && (LOCALES as string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // localStorage unavailable (private mode/SSR) -> default
  }
  return DEFAULT_LOCALE;
}

type TFn = <K extends keyof Messages>(key: K) => Messages[K];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFn;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const t = useCallback<TFn>(
    (key) => MESSAGES[locale][key] ?? (key as Messages[typeof key]),
    [locale]
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx === null) {
    throw new Error("useT must be used within a LocaleProvider");
  }
  return ctx;
}
```

> Note: match the `act` import style used by the existing `apps/web/src/pages/auth.test.tsx` (the repo already configures `IS_REACT_ACT_ENVIRONMENT`). If `auth.test.tsx` imports `act` from `react-dom/test-utils`, use that here too instead of `from "react"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/web/src/i18n/locale-context.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/locale-context.tsx apps/web/src/i18n/locale-context.test.tsx
git commit -m "feat(web): LocaleProvider + useT hook (localStorage, html lang sync)"
```

---

## Task 3: Wire provider into the app + test helper

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/index.html:2`
- Create: `apps/web/src/test-utils/render-with-locale.tsx`

- [ ] **Step 1: Wrap App with LocaleProvider**

`apps/web/src/main.tsx` — add the import and wrap (outermost so all of App, including any error boundaries, can translate):

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app";
import { LocaleProvider } from "./i18n/locale-context.js";
import "./design/tokens.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
});

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <React.StrictMode>
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </LocaleProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Default the static HTML lang to Turkish**

`apps/web/index.html` line 2: change `<html lang="en">` to `<html lang="tr">` (the provider keeps it in sync at runtime; this sets the pre-hydration default).

- [ ] **Step 3: Create the test helper**

`apps/web/src/test-utils/render-with-locale.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LocaleProvider } from "../i18n/locale-context.js";
import type { Locale } from "../i18n/messages.js";

export interface RenderResult {
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}

// Renders `ui` inside a LocaleProvider forced to `locale` (default "en" so
// existing English-asserting tests keep working). Sets localStorage before
// mount so the provider picks up the requested locale.
export function renderWithLocale(ui: React.ReactNode, locale: Locale = "en"): RenderResult {
  localStorage.setItem("a11yaudit-locale", locale);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<LocaleProvider>{ui}</LocaleProvider>);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}
```

- [ ] **Step 4: Verify build + existing tests still pass**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — expect no errors.
Run: `./node_modules/.bin/vitest run apps/web` — expect all existing tests still PASS (no page uses `useT` yet, so nothing breaks; `main.tsx` is not imported by tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/main.tsx apps/web/index.html apps/web/src/test-utils/render-with-locale.tsx
git commit -m "feat(web): mount LocaleProvider, default html lang tr, add renderWithLocale test helper"
```

---

## Task 4: Localize the shell (sidebar, top bar, language switcher)

**Files:**
- Modify: `apps/web/src/design/shell.tsx`

- [ ] **Step 1: Replace nav/config item labels and add `useT`**

In `apps/web/src/design/shell.tsx`, the `navItems`/`configItems` arrays currently hold literal `label`. Change them to carry a `labelKey: keyof Messages` and resolve via `t` at render. Replace the arrays:

```tsx
import { useT } from "../i18n/locale-context.js";
import type { Messages } from "../i18n/messages.js";

const navItems: Array<{ id: TopLevelPage; labelKey: keyof Messages; icon: IconName }> = [
  { id: "overview", labelKey: "nav.overview", icon: "layout-dashboard" },
  { id: "projects", labelKey: "nav.projects", icon: "folder" },
  { id: "new-scan", labelKey: "nav.newScan", icon: "scan-search" },
  { id: "scan-runs", labelKey: "nav.scanRuns", icon: "activity" },
  { id: "findings", labelKey: "nav.findings", icon: "list" },
  { id: "reports", labelKey: "nav.reports", icon: "file-text" }
];

const configItems: Array<{ id: TopLevelPage; labelKey: keyof Messages; icon: IconName }> = [
  { id: "settings", labelKey: "nav.settings", icon: "settings" },
  { id: "docs", labelKey: "nav.docs", icon: "book-open" }
];
```

Update `NavButton` to take `labelKey` and call `useT`:

```tsx
function NavButton({ item, route, navigate }: { item: { id: TopLevelPage; labelKey: keyof Messages; icon: IconName }; route: Route; navigate: Navigate }) {
  const { t } = useT();
  const active = isActive(route, item.id);
  return (
    <button aria-current={active ? "page" : undefined} className={active ? "on" : ""} onClick={() => navigate({ page: item.id })} type="button">
      <Icon name={item.icon} size={16} />
      <span>{t(item.labelKey)}</span>
    </button>
  );
}
```

- [ ] **Step 2: Localize Sidebar literals**

In `Sidebar`, call `const { t } = useT();` and replace: the Members nav item `label: "Members"` → `labelKey: "nav.members"`; `<div className="nav-section">Configure</div>` → `{t("nav.configure")}`; `<small>WCAG 2.2 Console</small>` → `{t("shell.brandSub")}`; `<div className="foot-title">Self-hosted instance</div>` → `{t("shell.selfHosted")}`; `<div className="mono foot-copy">local API · v0.1.0</div>` → `{t("shell.localApi")}`. (The Members `NavButton` item becomes `{ id: "members", labelKey: "nav.members", icon: "shield-check" }`.)

- [ ] **Step 3: Localize the menu labels**

`ProjectSelector`: `const { t } = useT();` and `<div className="menu-label">Switch project</div>` → `{t("shell.switchProject")}`. `WorkspaceSelector`: same, `Switch workspace` → `{t("shell.switchWorkspace")}`.

- [ ] **Step 4: Localize TopBar + add the language switcher**

In `TopBar`, add `const { t, locale, setLocale } = useT();`. Replace:
- `<Button ...>New Scan</Button>` → `>{t("common.newScan")}`.
- `<span className="sr-only">Search findings, URLs, and WCAG criteria</span>` → `{t("shell.searchLabel")}`.
- `placeholder="Search findings, URLs, WCAG criteria..."` → `placeholder={t("shell.searchPlaceholder")}`.
- theme button `aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}` → `aria-label={theme === "light" ? t("shell.switchThemeDark") : t("shell.switchThemeLight")}`.
- github button `aria-label`/`title` `"Repository link is not configured"` → `{t("shell.repoNotConfigured")}` (both attributes).
- `<Button aria-label="Sign out" ... />` → `aria-label={t("shell.signOut")}`.
- `<div className="local-status"><span className="health-dot" /> Local</div>` → `{t("shell.local")}`.

Add the switcher just before the theme button (after `<div className="top-spacer" />`):

```tsx
<div className="lang-switch" role="group" aria-label={t("shell.language")}>
  {(["tr", "en"] as const).map((code) => (
    <button
      key={code}
      type="button"
      aria-pressed={locale === code}
      className={locale === code ? "on" : ""}
      onClick={() => setLocale(code)}
    >
      {code.toUpperCase()}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Verify + commit**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — no errors.
Run: `./node_modules/.bin/vitest run apps/web` — existing tests still pass (shell not directly asserted; if any test renders the shell it must use `renderWithLocale`).

```bash
git add apps/web/src/design/shell.tsx
git commit -m "feat(web): localize shell nav/top bar and add TR/EN language switcher"
```

---

## Task 5: Localize shared badges + locale-aware date formatting

**Files:**
- Modify: `apps/web/src/data.ts`
- Modify: `apps/web/src/design/ui.tsx`

- [ ] **Step 1: Make `formatDate` locale-aware and key severity labels**

In `apps/web/src/data.ts`:
- Change `severityMeta` to carry a message key instead of a literal label:

```ts
import type { Messages } from "./i18n/messages.js";

export const severityMeta: Record<Severity, { labelKey: keyof Messages; rank: number }> = {
  critical: { labelKey: "severity.critical", rank: 0 },
  serious: { labelKey: "severity.serious", rank: 1 },
  moderate: { labelKey: "severity.moderate", rank: 2 },
  minor: { labelKey: "severity.minor", rank: 3 }
};
```

- Change `formatDate` to accept a locale and a "not available" label (keep it pure — do not import the catalog here to avoid a cycle; the caller passes the localized fallback):

```ts
import type { Locale } from "./i18n/messages.js";

export function formatDate(value: string | null, locale: Locale, notAvailable: string): string {
  if (value === null) {
    return notAvailable;
  }
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
```

- Change `formatBytes` to accept the localized "pending" label:

```ts
export function formatBytes(value: number, pending: string): string {
  if (value <= 0) {
    return pending;
  }
  return `${(value / 1_000_000).toFixed(1)} MB`;
}
```

> Every `formatDate(x)` / `formatBytes(x)` call site (overview, scan-runs, reports, finding-detail, members) must be updated to pass `locale`/labels from `useT()` — done in the per-page tasks below. After this step those call sites will not typecheck until their task runs; that is expected, so **do not run the full typecheck as a gate at the end of this task** — only build after Task 9/10. To keep commits green, update the call sites within this task is NOT required, but the per-page tasks (8, 9, 10) MUST update them. (See "Call-site checklist" at the end.)

- [ ] **Step 2: Localize the badge components**

In `apps/web/src/design/ui.tsx`, import and use `useT`:

```tsx
import { useT } from "../i18n/locale-context.js";
```

`SeverityBadge`: `const { t } = useT();` and `{severityMeta[level].label}` → `{t(severityMeta[level].labelKey)}`.

`StatusBadge`: replace the literal label with a keyed lookup:

```tsx
export function StatusBadge({ status }: { status: FindingStatus }) {
  const { t } = useT();
  const labelKey = status === "new" ? "status.new" : status === "resolved" ? "status.resolved" : "status.ongoing";
  const icon: IconName = status === "new" ? "circle-dot" : status === "resolved" ? "check-circle" : "clock";
  return (
    <span className={`badge status ${status}`}>
      <Icon name={icon} size={11} />
      {t(labelKey)}
    </span>
  );
}
```

`RunStatusBadge`: replace the capitalize-derived label with a keyed map:

```tsx
export function RunStatusBadge({ status }: { status: ScanStatus }) {
  const { t } = useT();
  const labelKey = `status.${status}` as const;
  const icon: IconName = status === "completed" ? "check-circle" : status === "failed" ? "alert-octagon" : status === "queued" ? "clock" : "loader";
  return (
    <span className={`badge run ${status}`}>
      <Icon name={icon} size={11} className={icon === "loader" ? "spin" : undefined} />
      {t(labelKey)}
    </span>
  );
}
```

`ViewportBadge`: `const { t } = useT();` and replace `Both` → `{t("viewport.both")}`, `Desktop`/`Mobile` → `{t(viewport === "desktop" ? "viewport.desktop" : "viewport.mobile")}`.

- [ ] **Step 3: Verify types within these files + commit**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — expect errors ONLY at `formatDate`/`formatBytes`/`severityMeta.label` call sites in pages not yet migrated. Confirm there are no NEW errors inside `data.ts`/`ui.tsx` themselves. (These page call sites are fixed in Tasks 8–10.)

```bash
git add apps/web/src/data.ts apps/web/src/design/ui.tsx
git commit -m "feat(web): locale-aware formatDate/formatBytes and keyed severity/status/viewport badges"
```

---

## Task 6: Localize app.tsx (docs, loading, demo banner)

**Files:**
- Modify: `apps/web/src/app.tsx`

- [ ] **Step 1: Add `useT` and replace literals**

Add `import { useT } from "./i18n/locale-context.js";` and, in the component(s) that render these, `const { t } = useT();`. Replace by the inventory:
- Docs subtitle/title/scope: `"Operator notes for this open-source, self-hosted MVP."` → `t("docs.subtitle")`; PageHeader title `"Documentation"` → `t("nav.docs")`; `"MVP scope"` → `t("docs.mvpScope")`; the scope body paragraph → `t("docs.scopeBody")`; the four list items → `t("docs.bullet1")`…`t("docs.bullet4")`.
- `aria-label="Main content"` → `t("app.mainContent")`.
- Demo banner `"API data is unavailable, so the interface is showing local demo data."` → `t("app.demoBanner")`.
- New Scan button `"New Scan"` → `t("common.newScan")`.
- Loading state `"Loading"` → `t("common.loading")`; `"Preparing your session."` → `t("app.preparingSession")`.

> If a literal lives in a component that does not currently have access to the hook (e.g. a top-level loading screen rendered before providers), confirm it is rendered *inside* `LocaleProvider` (it is — `main.tsx` wraps `App`). Call `useT()` at the top of that component.

- [ ] **Step 2: Verify + commit**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — no new errors in `app.tsx`.

```bash
git add apps/web/src/app.tsx
git commit -m "feat(web): localize app shell copy (docs, loading, demo banner)"
```

---

## Task 7: Localize auth pages + workspaces, update auth test

**Files:**
- Modify: `apps/web/src/pages/login.tsx`, `signup.tsx`, `invite.tsx`, `workspaces.tsx`
- Modify: `apps/web/src/pages/auth.test.tsx`

- [ ] **Step 1: Localize login.tsx**

Add `const { t } = useT();` (import from `../i18n/locale-context.js`). Replace: subtitle `"Sign in to your workspace."` → `t("auth.signInSubtitle")`; PageHeader title `"Sign in"` → `t("auth.signIn")`; Panel title `"Account"` → `t("auth.account")`; Field `"Email"` → `t("auth.email")`; `"Password"` → `t("auth.password")`; submit `"Sign in"` → `t("auth.signIn")`; error `"Sign in failed. Check your email and password."` → `t("auth.signInFailed")`. (Keep the existing onSignup cross-link; localize its visible text if any to `t("auth.createAccount")`.)

- [ ] **Step 2: Localize signup.tsx**

`"Create an account and workspace."` → `t("auth.createSubtitle")`; title `"Create account"` → `t("auth.createAccount")`; `"Account details"` → `t("auth.accountDetails")`; `"Full name"` → `t("auth.fullName")`; `"Email"` → `t("auth.email")`; `"Password"` → `t("auth.password")`; `"Workspace name"` → `t("auth.workspaceName")`; submit `"Create account"` → `t("auth.createAccount")`; error → `t("auth.signupFailed")`. Localize the "Already have an account?" cross-link text to `t("auth.signIn")`.

- [ ] **Step 3: Localize invite.tsx**

`"Join a workspace with your invitation."` → `t("auth.acceptSubtitle")`; title `"Accept invite"` → `t("auth.acceptInvite")`; `"Account details"` → `t("auth.accountDetails")`; `"Full name"` → `t("auth.fullName")`; `"Email"` → `t("auth.email")`; `"Password"` → `t("auth.password")`; submit `"Accept invite"` → `t("auth.acceptInvite")`; error → `t("auth.inviteFailed")`.

- [ ] **Step 4: Localize workspaces.tsx**

`"Choose the workspace you want to open."` → `t("workspaces.subtitle")`; title `"Workspaces"` → `t("workspaces.title")`; `"Your workspaces"` → `t("workspaces.your")`; `"Open"` → `t("common.open")`; `"No workspaces are available for this account."` → `t("workspaces.empty")`.

- [ ] **Step 5: Update auth.test.tsx to render within a forced locale**

The auth tests assert English labels. Wrap their render in the helper forcing `"en"`. Change each `act(() => root.render(<Login .../>))` style call to render through `renderWithLocale(<Login .../>, "en")` (import `renderWithLocale` from `../test-utils/render-with-locale.js`), OR if they call `createRoot` directly, wrap the rendered element with `<LocaleProvider>` after `localStorage.setItem("a11yaudit-locale", "en")` in a `beforeEach`. Keep all existing English assertions. Then add one default-locale test:

```tsx
it("renders the Turkish sign-in heading by default", () => {
  localStorage.setItem("a11yaudit-locale", "tr");
  const { container } = renderWithLocale(<Login onAuthenticated={() => {}} onSignup={() => {}} />, "tr");
  expect(container.textContent).toContain("Giriş Yap");
});
```

(Match the actual `Login` prop names from `login.tsx`/`page-props.ts`.)

- [ ] **Step 6: Run + commit**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/auth.test.tsx` — PASS.
Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — no new errors in these files.

```bash
git add apps/web/src/pages/login.tsx apps/web/src/pages/signup.tsx apps/web/src/pages/invite.tsx apps/web/src/pages/workspaces.tsx apps/web/src/pages/auth.test.tsx
git commit -m "feat(web): localize auth + workspaces pages, force en in auth tests, add tr default test"
```

---

## Task 8: Localize overview, projects, new-scan, scan-runs

**Files:**
- Modify: `apps/web/src/pages/overview.tsx`, `projects.tsx`, `new-scan.tsx`, `scan-runs.tsx`
- Modify: `apps/web/src/pages/scan-runs.test.ts`

- [ ] **Step 1: overview.tsx**

Add `const { t, locale } = useT();`. Replace each literal per the inventory using these keys: `overview.latestPdf`, `common.startScan`, `overview.accessibilityScore`, `overview.scoreHint`, `overview.scoreDisclaimer`, `overview.uniqueIssues`, `overview.groupedProblems`, `overview.affectedPages`, `overview.sampledFromIssues`, `overview.occurrences`, `overview.rawDetections`, `overview.criticalIssues`, `overview.highestSeverity`, `overview.triage`, `overview.issuesBySeverity`, `overview.severityDistribution`, `overview.viewportSplit`, `viewport.desktop`, `viewport.mobile`, `overview.viewportHint`, `overview.currentRun`, `overview.noRunning`, `overview.topRecurring`, `overview.allRuns`, `overview.recentRuns`, and the recent-runs table headers `table.run`, `table.status`, `table.started`, `table.occurrences`. Update the `formatDate(...)` call(s): `formatDate(value, locale, t("common.notAvailable"))`.

- [ ] **Step 2: projects.tsx**

`const { t } = useT();`. Keys: `projects.newProject`, `projects.subtitle`, `nav.projects` (title), `projects.uniqueIssues`, `projects.reports`, `projects.viewports`, `projects.lastScan`, `projects.modelTitle`, `projects.modelSub`, `projects.modelBody`.

- [ ] **Step 3: new-scan.tsx**

`const { t } = useT();`. Map every inventory line to its `scan.*` key (and `common.cancel`, `common.starting`, `common.startScan`, `common.none`). For the interpolated profile lines use the function entries: Limits value → `{selectedMode === "single" ? t("scan.onePage") : t("scan.limitsValue")(maxPages, maxDepth)}`; Viewports value → `{selectedViewports.join(" + ") || t("common.none")}`. Mode `<option>`s use `scan.singleUrl` / `scan.fullSite`. Run-profile rows use `scan.scope`/`scan.scopeCrawl`/`scan.scopeSingle`, `scan.limits`, `scan.viewports`, `scan.authentication`/`scan.authNotSupported`, `scan.evidence`/`scan.evidenceValue`, `scan.reports`/`scan.reportsValue`, `scan.safetyNote`.

- [ ] **Step 4: scan-runs.tsx**

`const { t } = useT();`. Keys: `common.newScan`, `runs.subtitle`, `nav.scanRuns` (title), `runs.runs`, table headers `table.run`/`table.project`/`table.status`/`table.profile`/`table.target`/`table.progress`/`table.occurrences`/`table.started`. The mode cell `"Full site"`/`"Single URL"` → `t("runs.fullSite")`/`t("runs.singleUrl")`. The profile meta line `${scan.viewports} · ${scan.maxPages} pages · depth ${scan.maxDepth}` → `t("runs.profileMeta")(scan.viewports, scan.maxPages, scan.maxDepth)`.

- [ ] **Step 5: Update scan-runs.test.ts**

It renders the scan-runs page and asserts English text (e.g. column headers, "Single URL"/"Full site"). Render through `renderWithLocale(<ScanRuns .../>, "en")` and keep English assertions. If the test asserts the profile-meta string, update the expectation to match `"... · N pages · depth D"` (unchanged in en). Run and fix assertions to the en catalog values.

- [ ] **Step 6: Verify + commit**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/scan-runs.test.ts` — PASS.
Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — no new errors in these files.

```bash
git add apps/web/src/pages/overview.tsx apps/web/src/pages/projects.tsx apps/web/src/pages/new-scan.tsx apps/web/src/pages/scan-runs.tsx apps/web/src/pages/scan-runs.test.ts
git commit -m "feat(web): localize overview, projects, new-scan, scan-runs pages"
```

---

## Task 9: Localize findings, finding-detail, reports

**Files:**
- Modify: `apps/web/src/pages/findings.tsx`, `finding-detail.tsx`, `reports.tsx`
- Modify: `apps/web/src/pages/findings.test.ts`, `reports.test.ts`

- [ ] **Step 1: findings.tsx**

`const { t } = useT();`. Keys: `findings.subtitle`, `nav.findings` (title), `findings.markResolved`, `findings.markResolvedDisabled` (the disabled-button title), `findings.issueGroups`, `findings.csvDisabled`, `findings.allSeverities`, table headers `table.severity`/`table.issue`/`table.wcag`/`table.likelyScope`/`table.component`/`table.cmsHint`/`table.pages`/`table.occurrences`, `findings.empty`.

- [ ] **Step 2: finding-detail.tsx**

`const { t, locale } = useT();`. Map every inventory line to its `finding.*` key. For `"Not captured"` (two sites) use `t("common.notCaptured")`. The screenshot alt `${finding.title} screenshot evidence` → `t("finding.screenshotAlt")(finding.title)`. `"Download"` → `t("common.download")`. Back links → `t("finding.back")`. WCAG criterion name display (if shown): resolve via `getCriterionContent(criterionId, locale)?.name ?? criterionId` (import `getCriterionContent` from `@a11yaudit/core`); if the page only shows the criterion id string, leave the id as-is. Update any `formatDate`/`formatBytes` calls to pass `locale`/labels.

- [ ] **Step 3: reports.tsx**

`const { t, locale } = useT();`. Keys: `common.runScan`, `reports.subtitle`, `nav.reports` (title), `reports.artifacts`, `reports.csvNote`, table headers `table.report`/`table.project`/`table.scan`/`table.status`/`table.size`/`table.created`/`table.action`, `common.download`. Report name `${report.kind.toUpperCase()} accessibility report` → `t("reports.reportName")(report.kind)`. Status `"Generating"` → `t("reports.generating")`. Update `formatDate(report.createdAt, locale, t("common.notAvailable"))` and `formatBytes(report.sizeBytes, t("common.pending"))`.

- [ ] **Step 4: Update findings.test.ts + reports.test.ts**

Both render their page and assert English text. Render through `renderWithLocale(<Findings .../>, "en")` / `renderWithLocale(<Reports .../>, "en")`, keep English assertions, fix any to match the en catalog (e.g. column header text). Run each.

- [ ] **Step 5: Verify + commit**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/findings.test.ts apps/web/src/pages/reports.test.ts` — PASS.
Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — no new errors in these files.

```bash
git add apps/web/src/pages/findings.tsx apps/web/src/pages/finding-detail.tsx apps/web/src/pages/reports.tsx apps/web/src/pages/findings.test.ts apps/web/src/pages/reports.test.ts
git commit -m "feat(web): localize findings, finding-detail, reports pages"
```

---

## Task 10: Localize members + settings, update members test

**Files:**
- Modify: `apps/web/src/pages/members.tsx`, `settings.tsx`
- Modify: `apps/web/src/pages/members.test.tsx`

- [ ] **Step 1: members.tsx**

`const { t, locale } = useT();`. Keys: title `nav.members`, `members.workspaceMembership`, `members.ownerRequired`, `members.ownerRequiredBody`, `members.manage`, `members.invite`, `table.email` (field label), `members.emailPlaceholder`, `members.sendInvite`, `members.inviteOnce`, `common.copy`, table headers `table.name`/`table.email`/`table.role`/`table.actions`, role select `aria-label` `Role for ${member.email}` → `t("members.roleFor")(member.email)`, role options `"owner"`/`"member"` → `t("members.roleOwner")`/`t("members.roleMember")`, `common.remove`, `members.pending`, `members.pendingEmpty`, `table.email`/`table.expires`/`table.actions` (invite table), `members.regenerate`, `members.revoke`. Update the invitation expiry render `new Date(invitation.expiresAt).toLocaleDateString()` → `new Date(invitation.expiresAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB")`.

- [ ] **Step 2: settings.tsx**

`const { t } = useT();`. Keys: `settings.subtitle`, `nav.settings` (title), `settings.scanDefaults`, `settings.defaultUrl`, `settings.crawlLimit`, `settings.reportFormat`, `settings.reportFormatValue`, `settings.artifactOutput`, `settings.artifactOutputValue`, `settings.evidenceRetention`, `settings.storeSnippets`, `settings.storeSnippetsHint`, `settings.storeScreenshots`, `settings.storeScreenshotsHint`, `settings.authStorage`, `settings.authStorageHint`, `settings.storageNote`.

- [ ] **Step 3: Update members.test.tsx**

It renders the members page and asserts English labels (e.g. "Invite a member", "Send invite", role options, "Pending invitations"). Render through `renderWithLocale(<Members .../>, "en")`, keep the English assertions, fix any to the en catalog values. The `fillInput`/label-finder helper that matches `"Email"` keeps working under `en`. Run.

- [ ] **Step 4: Verify + commit**

Run: `./node_modules/.bin/vitest run apps/web/src/pages/members.test.tsx` — PASS.
Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — **expect zero errors now** (all call sites migrated).

```bash
git add apps/web/src/pages/members.tsx apps/web/src/pages/settings.tsx apps/web/src/pages/members.test.tsx
git commit -m "feat(web): localize members and settings pages"
```

---

## Task 11: Full suite + docs principle update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full typecheck + test suite**

Run: `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` — zero errors.
Run: `./node_modules/.bin/vitest run apps/web` — all web tests PASS.
Run: `./node_modules/.bin/vitest run` — full monorepo suite PASS (no other package depends on web; should be green).

- [ ] **Step 2: Update the product principle**

In `CLAUDE.md`, under "## Product principles (enforce in copy)", change the first bullet so "English-only" is scoped to code surfaces and the web UI joins the report as a localized surface. Replace the first sentence of that bullet with:

> - **English-only *code* surface** (rule identifiers, code, comments, CLI, server logs). The **web UI and the downloaded audit report are localized** (Turkish default, English available) because the customer base is Turkish — they are the surfaces exempt from English-only. The web UI uses a typed in-house message catalog (`apps/web/src/i18n/`), default `tr`, switchable in the top bar; axe finding titles remain English (engine output), while WCAG criterion names render localized. Report criterion copy lives in `packages/core/src/wcag-content.ts`.

Keep the rest of the bullet (report localization detail) intact.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: scope English-only to code; web UI + report are localized surfaces"
```

---

## Call-site checklist (formatDate / formatBytes / severityMeta)

After Task 5 changes their signatures, every caller must be updated (covered by Tasks 8–10). Verify none remain by grepping before the final commit:

```bash
grep -rn "formatDate(" apps/web/src        # every call passes (value, locale, t("common.notAvailable"))
grep -rn "formatBytes(" apps/web/src       # every call passes (value, t("common.pending"))
grep -rn "severityMeta\[" apps/web/src     # every use reads .labelKey via t(...), not .label
grep -rn '\.label\b' apps/web/src/design/ui.tsx  # no severityMeta[...].label remains
```

Expected after Task 10: all call sites updated; `tsc` clean.

---

## Notes for the implementer

- **DRY:** the catalog is the single source of copy. Migration tasks only wire `t("key")` — never reintroduce a literal.
- **`useT` must be called inside a component** (React hook rules). For arrays like `navItems`, store `labelKey` and resolve inside the rendering component.
- **Hooks + providers:** every page is rendered under `LocaleProvider` (via `main.tsx`), so `useT()` is always available at runtime. In tests, always render through `renderWithLocale` (defaults to `en` so existing assertions hold).
- **Do not translate** axe finding/issue `title`/`description`/`recommendation` (API/demo data). Only chrome.
- **Accessibility preserved:** keep all `aria-label`/`role`/`aria-pressed` attributes; only their text values change.
