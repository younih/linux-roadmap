#!/usr/bin/env bash
# deploy.sh — یک‌دستوری دیپلوی «نقشه راه لینوکس»
# استفاده:
#   bash deploy.sh              ← منوی تعاملی
#   bash deploy.sh --github     ← GitHub Pages (شاخه gh-pages)
#   bash deploy.sh --cloudflare ← Cloudflare Pages (پوش به main)
#   bash deploy.sh --build-only ← فقط ساخت، بدون پوش
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# رنگ‌ها
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

say()  { echo -e "${GREEN}✔${NC} $1"; }
info() { echo -e "${CYAN}ℹ${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✘${NC} $1"; exit 1; }

# فایل‌های خروجی که باید دیپلوی شوند
OUTPUT_FILES=(
  linux-roadmap-fa.html
  index.html
  linux-roadmap-sw.js
  linux-roadmap-manifest.json
  linux-roadmap-icon.svg
)

# فایل‌های سورس (در gh-pages لازم نیستند)
SOURCE_FILES=(
  build.js
  template.html
  README-fa.md
  deploy.sh
)

# ───── مرحله ۱: چک پیش‌نیازها ─────
check_prereqs() {
  info "چک پیش‌نیازها…"
  command -v node  >/dev/null 2>&1 || err "Node.js نصب نیست — اول نصب کن: https://nodejs.org"
  command -v git   >/dev/null 2>&1 || err "Git نصب نیست — اول نصب کن: https://git-scm.com"
  [ -f "build.js"     ] || err "فایل build.js پیدا نشد — مطمئن شو توی پوشه پروژه هستی"
  [ -f "template.html" ] || err "فایل template.html پیدا نشد"
  [ -f "README-fa.md"  ] || err "فایل README-fa.md پیدا نشد"
  say "همه پیش‌نیازها موجودند"
}

# ───── مرحله ۲: بیلد ─────
do_build() {
  info "در حال ساخت پروژه…"
  node build.js
  say "بیلد موفق — $(du -h linux-roadmap-fa.html
  index.html | cut -f1)"

  # تأیید وجود فایل‌های PWA
  for f in "${OUTPUT_FILES[@]}"; do
    [ -f "$f" ] || err "فایل خروجی $f ساخته نشد — build.js رو چک کن"
  done
  say "هر ۴ فایل خروجی حاضرند"
}

# ───── مرحله ۳: ایجاد gitignore اگر نیست ─────
ensure_gitignore() {
  if [ ! -f ".gitignore" ]; then
    info "ساخت .gitignore…"
    cat > .gitignore <<'EOF'
# سورس (فقط برای بیلد لازمه، نه دیپلوی)
build.js
template.html
README-fa.md
deploy.sh

# سیستمی
.freebuff/
node_modules/
.DS_Store
Thumbs.db
*.log
EOF
    say ".gitignore ساخته شد"
  fi
}

# ───── مرحله ۴: گیت init اگر نیست ─────
ensure_git() {
  if [ ! -d ".git" ]; then
    info "ساخت مخزن گیت…"
    git init
    git checkout -b main 2>/dev/null || git checkout -b master 2>/dev/null || true
    say "مخزن گیت ساخته شد (شاخه main)"
  fi
  # مطمئن شو ایمیل و نام تنظیم شده
  if ! git config user.email >/dev/null 2>&1; then
    warn "ایمیل گیت تنظیم نشده — از آدرس موقت استفاده می‌شه"
    git config user.email "deploy@linux-roadmap.local"
  fi
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "Linux Roadmap Deploy"
  fi
}

# ───── روش ۱: GitHub Pages (شاخه gh-pages) ─────
deploy_github() {
  info "🚀 دیپلوی روی GitHub Pages (شاخه gh-pages)…"

  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

  # مطمئن شو gh-pages وجود نداره یا پاکش کن
  git branch -D gh-pages 2>/dev/null || true

  # checkout orphan
  git checkout --orphan gh-pages

  # فقط فایل‌های خروجی رو نگه دار
  git rm -rf . 2>/dev/null || true
  for f in "${OUTPUT_FILES[@]}"; do
    if [ -f "$f" ]; then
      cp "$f" "$f"
      git add "$f"
    fi
  done

  git commit -m "🚀 دیپلوی خودکار — $(date '+%Y-%m-%d %H:%M')" || warn "کامیت خالی بود — فایل‌ها از قبل آپدیت بودن"

  # برگرد به شاخه اصلی
  git checkout "$branch" 2>/dev/null || git checkout -b "$branch"

  echo ""
  say "دیپلوی GitHub Pages آماده‌ست!"
  echo ""
  echo -e "  ${YELLOW}حالا دستورات زیر رو اجرا کن:${NC}"
  echo ""
  echo "  git push origin gh-pages --force"
  echo ""
  echo "  بعدش برو به تنظیمات ریپو توی GitHub:"
  echo "  Settings → Pages → Source: Deploy from branch → gh-pages → / (root)"
  echo ""
  echo -e "  ${CYAN}آدرس سایت:${NC} https://USERNAME.github.io/REPO-NAME/"
}

# ───── روش ۲: Cloudflare Pages (پوش به main) ─────
deploy_cloudflare() {
  info "☁️  دیپلوی روی Cloudflare Pages (پوش به شاخه اصلی)…"

  # فقط فایل‌های خروجی + سورس رو کامیت کن
  git add "${OUTPUT_FILES[@]}" .gitignore

  # چک کن تغییری هست
  if git diff --cached --quiet 2>/dev/null; then
    warn "تغییری برای کامیت نیست"
  else
    local msg="☁️ دیپلوی خودکار — $(date '+%Y-%m-%d %H:%M')"
    git commit -m "$msg"
  fi

  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)

  echo ""
  say "دیپلوی Cloudflare Pages آماده‌ست!"
  echo ""
  echo -e "  ${YELLOW}حالا دستور زیر رو اجرا کن:${NC}"
  echo ""
  echo "  git push origin $branch"
  echo ""
  echo "  Cloudflare Pages به‌صورت خودکار متوجه تغییرات می‌شه و دیپلوی می‌کنه."
  echo "  (البته اول باید ریپو رو توی Cloudflare Dashboard وصل کرده باشی)"
  echo ""
  echo -e "  ${CYAN}آدرس سایت:${NC} https://PROJECT.pages.dev"
}

# ───── منوی تعاملی ─────
interactive_menu() {
  echo ""
  echo -e "  ${CYAN}🐧 اسکریپت دیپلوی «نقشه راه لینوکس»${NC}"
  echo ""
  echo "  ۱) GitHub Pages  — دیپلوی روی شاخه gh-pages"
  echo "  ۲) Cloudflare Pages — پوش به main، بیلد خودکار"
  echo "  ۳) فقط بیلد — بدون پوش یا کامیت"
  echo "  ۴) خروج"
  echo ""
  read -rp "  شماره رو وارد کن [۱-۴]: " choice

  case "$choice" in
    1) check_prereqs; ensure_gitignore; do_build; ensure_git; deploy_github ;;
    2) check_prereqs; ensure_gitignore; do_build; ensure_git; deploy_cloudflare ;;
    3) check_prereqs; do_build; say "فقط بیلد انجام شد — فایل‌های خروجی حاضرند 🐧" ;;
    4) info "خروج…" ; exit 0 ;;
    *) err "انتخاب نامعتبر" ;;
  esac
}

# ───── نقطه ورود ─────
case "${1:-}" in
  --github)
    check_prereqs
    ensure_gitignore
    do_build
    ensure_git
    deploy_github
    ;;
  --cloudflare)
    check_prereqs
    ensure_gitignore
    do_build
    ensure_git
    deploy_cloudflare
    ;;
  --build-only)
    do_build
    say "بیلد تموم شد — فایل‌ها آماده‌ست 🐧"
    ;;
  --help|-h)
    echo "استفاده: bash deploy.sh [--github|--cloudflare|--build-only]"
    echo ""
    echo "  --github      دیپلوی روی GitHub Pages (شاخه gh-pages)"
    echo "  --cloudflare  دیپلوی روی Cloudflare Pages (پوش به main)"
    echo "  --build-only  فقط بیلد، بدون گیت"
    echo "  (بدون فلگ)    منوی تعاملی"
    ;;
  *)
    interactive_menu
    ;;
esac
