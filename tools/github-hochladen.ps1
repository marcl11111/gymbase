# GymBase -> GitHub hochladen
# Laedt das Projekt in das Repository <dein-name>/gymbase hoch und ergaenzt dein Profil-README.
# Mehrfach ausfuehrbar: spaetere Aufrufe laden nur Aenderungen hoch.

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Info($t)  { Write-Host "`n==> $t" -ForegroundColor Yellow }
function Fehler($t) { Write-Host "`n[FEHLER] $t" -ForegroundColor Red; exit 1 }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }

function Need($cmd, $wingetId, $label) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { return }
  Write-Host "$label ist nicht installiert." -ForegroundColor Red
  $a = Read-Host "Jetzt mit winget installieren? (j/n)"
  if ($a -ne 'j') { Fehler "$label wird benoetigt." }
  winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fehler "$label wurde installiert, ist aber noch nicht im PATH. Bitte das Fenster schliessen und die Datei erneut starten." }
}

Info "Pruefe Git und GitHub CLI"
Need git 'Git.Git' 'Git'
Need gh  'GitHub.cli' 'GitHub CLI'

Info "GitHub-Anmeldung"
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Es oeffnet sich gleich der Browser. Code aus diesem Fenster dort eingeben und GitHub CLI erlauben."
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Fehler "Anmeldung fehlgeschlagen." }
}
gh auth setup-git *> $null
$user = (gh api user --jq .login).Trim()
$uid  = (gh api user --jq .id).Trim()
$displayName = (gh api user --jq '.name // .login').Trim()
if (-not $user) { Fehler "GitHub-Benutzer konnte nicht ermittelt werden." }
Write-Host "Angemeldet als: $user"

function Ensure-Identity {
  $mail = git config user.email
  if (-not $mail) {
    git config user.name  "$displayName"
    git config user.email "$uid+$user@users.noreply.github.com"
  }
}

# ---------------------------------------------------------------- GymBase-Repo
Info "Lokales Git-Repository vorbereiten"
if (-not (Test-Path (Join-Path $root '.git'))) {
  git init *> $null
  git checkout -b main *> $null
}
Ensure-Identity
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $hasCommits = $true
  git rev-parse --verify HEAD *> $null
  if ($LASTEXITCODE -ne 0) { $hasCommits = $false }
  if ($hasCommits) { $msg = "Update vom $(Get-Date -Format 'yyyy-MM-dd HH:mm')" } else { $msg = "GymBase 1.0.0 - erste Version" }
  git commit -m $msg | Out-Null
  Write-Host "Commit erstellt: $msg"
} else {
  Write-Host "Keine neuen Aenderungen zum Committen."
}

$repo = "$user/gymbase"
$desc = "GymBase - Fitness- und Trainingsplattform: Uebungsdatenbank mit Fotoanleitungen, Plan-Editor, Plan-Generator, Trainingsmodus und Fortschritt (React, TypeScript, Vite)"
gh repo view $repo *> $null
if ($LASTEXITCODE -ne 0) {
  Info "Repository $repo anlegen"
  $v = Read-Host "Sichtbarkeit: oeffentlich (o) oder privat (p)? [o]"
  if ($v -eq 'p') { $vis = '--private' } else { $vis = '--public' }
  git remote remove origin *> $null
  gh repo create $repo $vis --description $desc --source . --remote origin --push
  if ($LASTEXITCODE -ne 0) { Fehler "Repository konnte nicht erstellt werden." }
} else {
  Info "Repository $repo existiert - lade Aenderungen hoch"
  git remote remove origin *> $null
  git remote add origin "https://github.com/$repo.git"
  git push -u origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Push abgelehnt - GitHub hat Commits, die lokal fehlen. Fuehre zusammen (lokale Dateien haben Vorrang)..."
    git pull origin main --allow-unrelated-histories --no-rebase -X ours --no-edit
    if ($LASTEXITCODE -ne 0) { Fehler "Zusammenfuehren fehlgeschlagen. Bitte manuell pruefen: git status" }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { Fehler "Push fehlgeschlagen." }
  }
}
gh repo edit $repo --description $desc --add-topic react --add-topic typescript --add-topic vite --add-topic tailwindcss --add-topic gsap --add-topic fitness --add-topic workout-tracker --add-topic training-plan *> $null

# ---------------------------------------------------------------- Profil-README
Info "Profil-README ($user/$user) aktualisieren"
$prof = "$user/$user"
$tmp = Join-Path $env:TEMP "gymbase-profil-$user"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }

gh repo view $prof *> $null
if ($LASTEXITCODE -ne 0) {
  gh repo create $prof --public --description "Profil von $displayName" *> $null
  if ($LASTEXITCODE -ne 0) { Fehler "Profil-Repository konnte nicht erstellt werden." }
}
git clone "https://github.com/$prof.git" $tmp *> $null
if ($LASTEXITCODE -ne 0) { Fehler "Profil-Repository konnte nicht geklont werden." }

Push-Location $tmp
Ensure-Identity
git rev-parse --verify HEAD *> $null
$emptyRepo = ($LASTEXITCODE -ne 0)
if ($emptyRepo) { git checkout -b main *> $null }

$utf8 = New-Object System.Text.UTF8Encoding $false
$snippet = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'profil-readme-abschnitt.md'), $utf8).Replace('{{USER}}', $user).Trim()
$readme = Join-Path $tmp 'README.md'
if (Test-Path $readme) { $text = [IO.File]::ReadAllText($readme, $utf8) } else { $text = '' }

if ($text -match '(?s)<!-- GYMBASE:START -->.*<!-- GYMBASE:END -->') {
  $text = [regex]::Replace($text, '(?s)<!-- GYMBASE:START -->.*<!-- GYMBASE:END -->', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $snippet })
} elseif ($text.Trim() -eq '') {
  $text = "# Hi, ich bin $displayName`n`nIch baue eigene Tools, Automatisierungen und Web-Apps.`n`n## Projekte`n`n$snippet`n"
} elseif ($text -match '(?m)^## Projekte\s*$') {
  $text = [regex]::Replace($text, '(?m)^## Projekte\s*$', "## Projekte`n`n$snippet`n")
} else {
  $text = $text.TrimEnd() + "`n`n## Projekte`n`n$snippet`n"
}
[IO.File]::WriteAllText($readme, $text, $utf8)

git add README.md
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m "Profil: GymBase hinzugefuegt" | Out-Null
  if ($emptyRepo) { git push -u origin main } else { git push }
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fehler "Profil-README konnte nicht hochgeladen werden." }
  Write-Host "Profil-README aktualisiert."
} else {
  Write-Host "Profil-README ist bereits aktuell."
}
Pop-Location
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Info "Fertig"
Write-Host "Repository: https://github.com/$repo"
Write-Host "Profil:     https://github.com/$user"
gh repo view $repo --web *> $null
