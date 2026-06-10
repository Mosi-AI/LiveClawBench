$Dataset = "Mosi-AI/LiveClawbench-trajectories"
$Config = "default"
$Split = "v0.1.0"
$BatchSize = 100
$BaseUrl = "https://datasets-server.huggingface.co"
$OutputFile = "$PSScriptRoot\..\site-data\raw-rows.json"

# Get total count
Write-Host "Fetching dataset info..."
$info = Invoke-RestMethod -Uri "$BaseUrl/info?dataset=$Dataset" -Method Get
$total = $info.dataset_info.$Config.splits.$Split.num_examples
Write-Host "Total rows: $total"

$allRows = @()
$offset = 0

while ($offset -lt $total) {
    $length = [Math]::Min($BatchSize, $total - $offset)
    Write-Host "  Fetching rows $($offset + 1)-$($offset + $length)..."
    
    $url = "$BaseUrl/rows?dataset=$Dataset&config=$Config&split=$Split&offset=$offset&length=$length"
    $data = Invoke-RestMethod -Uri $url -Method Get
    
    foreach ($row in $data.rows) {
        $allRows += $row.row
    }
    
    $offset += $length
}

Write-Host "Fetched $($allRows.Count) rows total"

# Save to file
# Depth must accommodate fully-nested trajectory payloads; otherwise the
# nested objects serialize as type-name strings ("System.Object[]") and
# downstream JSON.parse(trajectory) reads garbage.
$json = $allRows | ConvertTo-Json -Depth 100 -Compress
$json | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Saved to $OutputFile"
