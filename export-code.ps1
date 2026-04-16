# DiagSync Code Exporter - Run from project root
$outputFile = "DiagSync-Code.html"
$projectRoot = Get-Location

# File extensions to include
$extensions = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.prisma", "*.css", "*.env*", "*.md")

# Folders to exclude
$excludeFolders = @("node_modules", ".next", ".git", "dist", "build", ".cache")

# Files to exclude
$excludeFiles = @("package-lock.json", "yarn.lock", "pnpm-lock.yaml")

function Should-Exclude($path) {
    foreach ($folder in $excludeFolders) {
        if ($path -match [regex]::Escape($folder)) { return $true }
    }
    return $false
}

function Escape-Html($text) {
    $text = $text -replace '&', '&amp;'
    $text = $text -replace '<', '&lt;'
    $text = $text -replace '>', '&gt;'
    return $text
}

Write-Host "Collecting files..." -ForegroundColor Cyan

$allFiles = @()
foreach ($ext in $extensions) {
    $found = Get-ChildItem -Path $projectRoot -Recurse -Filter $ext -ErrorAction SilentlyContinue
    $allFiles += $found
}

# Filter out excluded folders and files
$allFiles = $allFiles | Where-Object {
    $file = $_
    $relativePath = $file.FullName.Replace($projectRoot.Path + "\", "")
    $excluded = Should-Exclude($relativePath)
    $nameExcluded = $excludeFiles -contains $file.Name
    (-not $excluded) -and (-not $nameExcluded)
} | Sort-Object FullName

Write-Host "Found $($allFiles.Count) files. Building HTML..." -ForegroundColor Cyan

# Build HTML
$html = @"
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DiagSync Code</title><style>
body{margin:0;padding:20px;background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:13px;line-height:1.6;}
.file-block{margin-bottom:48px;}
.file-header{background:#333;color:#9cdcfe;padding:8px 14px;font-weight:bold;font-size:13px;border-left:4px solid #569cd6;margin-bottom:0;}
pre{margin:0;padding:16px;background:#252526;overflow-x:auto;white-space:pre-wrap;word-break:break-word;border:1px solid #333;}
</style></head><body>
"@

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Replace($projectRoot.Path + "\", "").Replace("\", "/")
    
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
        if ($null -eq $content) { $content = "" }
        $escaped = Escape-Html($content)
        $html += "<div class='file-block'><div class='file-header'>$relativePath</div><pre>$escaped</pre></div>`n"
        Write-Host "  + $relativePath" -ForegroundColor Green
    } catch {
        Write-Host "  ! Skipped: $relativePath" -ForegroundColor Yellow
    }
}

$html += "</body></html>"

# Write output
$outputPath = Join-Path $projectRoot $outputFile
[System.IO.File]::WriteAllText($outputPath, $html, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "Done! File saved to: $outputPath" -ForegroundColor Green
Write-Host "Total files included: $($allFiles.Count)" -ForegroundColor Cyan

