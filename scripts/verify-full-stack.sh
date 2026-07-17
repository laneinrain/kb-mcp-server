#!/usr/bin/env bash
# Full-stack functional verification for kb-mcp-server v1.5
set -euo pipefail

API=http://127.0.0.1:3000
MCP=http://127.0.0.1:3100/mcp
WEB=http://localhost:5173
CHROMA=http://localhost:8000
MOCK=http://127.0.0.1:8765
PASS=0
FAIL=0
SKIP=0
RESULTS=()

ok() { PASS=$((PASS+1)); RESULTS+=("PASS  $1"); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); RESULTS+=("FAIL  $1 — $2"); echo "✗ $1 — $2"; }
skip() { SKIP=$((SKIP+1)); RESULTS+=("SKIP  $1 — $2"); echo "○ $1 — $2"; }

json() { python3 -c 'import json,sys; print(json.load(sys.stdin)'"$1"')' 2>/dev/null; }

echo "=== 1. Infrastructure ==="
code=$(curl -s -o /dev/null -w '%{http_code}' "$CHROMA/api/v2/heartbeat")
[[ "$code" == "200" ]] && ok "Chroma heartbeat" || bad "Chroma heartbeat" "HTTP $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/health")
[[ "$code" == "200" ]] && ok "Backend /health" || bad "Backend /health" "HTTP $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$WEB/")
[[ "$code" == "200" ]] && ok "Web Vite :5173" || bad "Web Vite :5173" "HTTP $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$MOCK/health")
[[ "$code" == "200" ]] && ok "Mock CherryIn :8765" || bad "Mock CherryIn" "HTTP $code"

echo "=== 2. Auth (register / login / admin) ==="
REG=$(curl -s -w '\n%{http_code}' -X POST "$API/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"11111111","password":"password123"}')
REG_CODE=$(echo "$REG" | tail -1)
REG_BODY=$(echo "$REG" | sed '$d')
if [[ "$REG_CODE" == "201" || "$REG_CODE" == "200" || "$REG_CODE" == "409" ]]; then
  ok "Register user 11111111 (HTTP $REG_CODE)"
else
  bad "Register user" "HTTP $REG_CODE body=$REG_BODY"
fi

LOGIN_A=$(curl -s -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"11111111","password":"password123"}')
TOKEN_A=$(echo "$LOGIN_A" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("accessToken") or d.get("tokens",{}).get("accessToken",""))' 2>/dev/null || true)
if [[ -n "$TOKEN_A" ]]; then ok "Login user A JWT"; else bad "Login user A" "$LOGIN_A"; fi

LOGIN_ADMIN=$(curl -s -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"00000","password":"admin123"}')
TOKEN_ADMIN=$(echo "$LOGIN_ADMIN" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("accessToken") or d.get("tokens",{}).get("accessToken",""))' 2>/dev/null || true)
if [[ -n "$TOKEN_ADMIN" ]]; then ok "Login admin 00000"; else bad "Login admin" "$LOGIN_ADMIN"; fi

LOGIN_B=$(curl -s -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"22222222","password":"password123"}')
# register B if needed
if ! echo "$LOGIN_B" | grep -q accessToken; then
  curl -s -X POST "$API/api/v1/auth/register" -H 'Content-Type: application/json' \
    -d '{"employeeId":"22222222","password":"password123"}' >/dev/null || true
  LOGIN_B=$(curl -s -X POST "$API/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"employeeId":"22222222","password":"password123"}')
fi
TOKEN_B=$(echo "$LOGIN_B" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("accessToken") or d.get("tokens",{}).get("accessToken",""))' 2>/dev/null || true)
if [[ -n "$TOKEN_B" ]]; then ok "Login user B JWT"; else bad "Login user B" "$LOGIN_B"; fi

ADMIN_USERS=$(curl -s -o /tmp/admin_users.json -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$API/api/v1/admin/users")
[[ "$ADMIN_USERS" == "200" ]] && ok "Admin GET /admin/users" || bad "Admin users" "HTTP $ADMIN_USERS"

FORBIDDEN=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN_A" "$API/api/v1/admin/users")
[[ "$FORBIDDEN" == "403" ]] && ok "Non-admin blocked from admin API (403)" || bad "Non-admin admin API" "HTTP $FORBIDDEN"

echo "=== 3. Document ingest (needs CherryIn) ==="
TMPDOC=$(mktemp /tmp/kb-verify-XXXX.txt)
cat > "$TMPDOC" <<'DOC'
知识库验证文档 Alpha。
RAG 使用向量检索与重排序提升精度。
MCP 工具应只返回当前用户可见的文档。
DOC

UPLOAD=$(curl -s -w '\n%{http_code}' -X POST "$API/api/v1/documents" \
  -H "Authorization: Bearer $TOKEN_A" \
  -F "file=@$TMPDOC;filename=verify-alpha.txt")
UP_CODE=$(echo "$UPLOAD" | tail -1)
UP_BODY=$(echo "$UPLOAD" | sed '$d')
DOC_A_ID=$(echo "$UP_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("documentId") or d.get("id") or d.get("document",{}).get("id",""))' 2>/dev/null || true)
UP_STATUS=$(echo "$UP_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("status",""))' 2>/dev/null || true)
UP_CHUNKS=$(echo "$UP_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("chunkCount",0))' 2>/dev/null || true)

if [[ ("$UP_CODE" == "201" || "$UP_CODE" == "200") && -n "$DOC_A_ID" && "$UP_CHUNKS" != "0" && "$UP_STATUS" == "indexed" ]]; then
  ok "Upload document as user A (HTTP $UP_CODE) id=$DOC_A_ID chunks=$UP_CHUNKS"
elif [[ ("$UP_CODE" == "201" || "$UP_CODE" == "200") && -n "$DOC_A_ID" ]]; then
  # Stale/empty registry row from a prior failed ingest — delete and retry once
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN_A" "$API/api/v1/documents/$DOC_A_ID" >/dev/null || true
  TMPDOC2=$(mktemp /tmp/kb-verify-XXXX.txt)
  cat > "$TMPDOC2" <<'DOC'
知识库验证文档 Alpha Retry。
RAG 使用向量检索与重排序提升精度。
MCP 工具应只返回当前用户可见的文档。
DOC
  UPLOAD=$(curl -s -w '\n%{http_code}' -X POST "$API/api/v1/documents" \
    -H "Authorization: Bearer $TOKEN_A" \
    -F "file=@$TMPDOC2;filename=verify-alpha-retry.txt")
  UP_CODE=$(echo "$UPLOAD" | tail -1)
  UP_BODY=$(echo "$UPLOAD" | sed '$d')
  DOC_A_ID=$(echo "$UP_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("documentId") or d.get("id",""))' 2>/dev/null || true)
  UP_CHUNKS=$(echo "$UP_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("chunkCount",0))' 2>/dev/null || true)
  if [[ -n "$DOC_A_ID" && "$UP_CHUNKS" != "0" ]]; then
    ok "Upload document as user A (retry HTTP $UP_CODE) id=$DOC_A_ID chunks=$UP_CHUNKS"
  else
    bad "Upload document as user A" "HTTP $UP_CODE $UP_BODY"
    DOC_A_ID=""
  fi
else
  bad "Upload document as user A" "HTTP $UP_CODE $UP_BODY"
  DOC_A_ID=""
fi

echo "=== 4. REST search + isolation ==="
if [[ -n "$DOC_A_ID" ]]; then
  SEARCH_A=$(curl -s -w '\n%{http_code}' -X POST "$API/api/v1/search" \
    -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
    -d '{"query":"重排序","topK":5}')
  SA_CODE=$(echo "$SEARCH_A" | tail -1)
  SA_BODY=$(echo "$SEARCH_A" | sed '$d')
  if [[ "$SA_CODE" == "200" ]]; then
    ok "REST search as user A"
    echo "$SA_BODY" | head -c 200; echo
  else
    bad "REST search as user A" "HTTP $SA_CODE $SA_BODY"
  fi

  # User B list should not include A's private doc
  LIST_B=$(curl -s -H "Authorization: Bearer $TOKEN_B" "$API/api/v1/documents")
  if echo "$LIST_B" | grep -q "$DOC_A_ID"; then
    bad "User B document list isolation" "saw doc $DOC_A_ID"
  else
    ok "User B cannot list user A document"
  fi

  GET_B=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_B" "$API/api/v1/documents/$DOC_A_ID")
  [[ "$GET_B" == "404" ]] && ok "User B GET user A doc → 404" || bad "User B GET isolation" "HTTP $GET_B"
else
  skip "REST search/isolation" "upload failed (likely missing real CHERRYIN_API_KEY)"
fi

echo "=== 5. MCP auth + tools ==="
MCP401=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$MCP" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}')
[[ "$MCP401" == "401" ]] && ok "MCP initialize without Bearer → 401" || bad "MCP no-auth gate" "HTTP $MCP401"

# Initialize with JWT
INIT=$(curl -s -D /tmp/mcp_hdrs.txt -o /tmp/mcp_init_body.txt -w '%{http_code}' -X POST "$MCP" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}')
SID=$(rg -i '^mcp-session-id:' /tmp/mcp_hdrs.txt | awk '{print $2}' | tr -d '\r')
if [[ "$INIT" == "200" && -n "$SID" ]]; then
  ok "MCP initialize with JWT (session=$SID)"
else
  bad "MCP initialize with JWT" "HTTP $INIT sid=$SID body=$(head -c 200 /tmp/mcp_init_body.txt)"
fi

if [[ -n "$SID" ]]; then
  curl -s -X POST "$MCP" \
    -H "Authorization: Bearer $TOKEN_A" \
    -H "mcp-session-id: $SID" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null

  LIST=$(curl -s -X POST "$MCP" \
    -H "Authorization: Bearer $TOKEN_A" \
    -H "mcp-session-id: $SID" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
  if echo "$LIST" | grep -q search_knowledge && echo "$LIST" | grep -q read_around && echo "$LIST" | grep -q read_file; then
    ok "MCP tools/list has 3 tools"
  else
    bad "MCP tools/list" "$(echo "$LIST" | head -c 300)"
  fi

  if [[ -n "$DOC_A_ID" ]]; then
    SEARCH_MCP=$(curl -s -X POST "$MCP" \
      -H "Authorization: Bearer $TOKEN_A" \
      -H "mcp-session-id: $SID" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_knowledge","arguments":{"query":"重排序","top_k":3}}}')
    if echo "$SEARCH_MCP" | grep -qi 'isError\|error'; then
      # may still succeed with results in SSE format
      if echo "$SEARCH_MCP" | grep -q 'documentId\|results'; then
        ok "MCP search_knowledge returned results"
      else
        bad "MCP search_knowledge" "$(echo "$SEARCH_MCP" | head -c 400)"
      fi
    else
      ok "MCP search_knowledge call completed"
    fi

    READ_MCP=$(curl -s -X POST "$MCP" \
      -H "Authorization: Bearer $TOKEN_A" \
      -H "mcp-session-id: $SID" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"read_file\",\"arguments\":{\"document_id\":\"$DOC_A_ID\"}}}")
    if echo "$READ_MCP" | grep -q 'verify-alpha\|Alpha\|chunk\|documentId'; then
      ok "MCP read_file own document"
    else
      bad "MCP read_file own document" "$(echo "$READ_MCP" | head -c 400)"
    fi

    RA_MCP=$(curl -s -X POST "$MCP" \
      -H "Authorization: Bearer $TOKEN_A" \
      -H "mcp-session-id: $SID" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"read_around\",\"arguments\":{\"document_id\":\"$DOC_A_ID\",\"chunk_index\":0,\"window\":1}}}")
    if echo "$RA_MCP" | grep -qi 'Alpha\|chunkIndex\|chunks\|verify-alpha'; then
      ok "MCP read_around own document"
    else
      bad "MCP read_around" "$(echo "$RA_MCP" | head -c 400)"
    fi
  else
    skip "MCP search/read_file" "no document uploaded"
  fi

  # Service API key path
  INIT_S=$(curl -s -D /tmp/mcp_svc_hdrs.txt -o /tmp/mcp_svc_body.txt -w '%{http_code}' -X POST "$MCP" \
    -H "Authorization: Bearer verify-service-api-key" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"svc","version":"1"}}}')
  [[ "$INIT_S" == "200" ]] && ok "MCP initialize with API_KEY service" || bad "MCP API_KEY service" "HTTP $INIT_S"
fi

echo "=== 6. Settings API ==="
SET_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN_A" "$API/api/v1/settings")
[[ "$SET_CODE" == "200" ]] && ok "GET /api/v1/settings" || bad "GET /api/v1/settings" "HTTP $SET_CODE"

PATCH_CODE=$(curl -s -o /tmp/settings_patch.json -w '%{http_code}' -X PATCH \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
  -d '{"readAroundWindowDefault":1,"readAroundWindowMax":3,"readAroundMaxChars":32000,"readFileMaxChunks":50,"readFileMaxChars":64000}' \
  "$API/api/v1/settings/context")
[[ "$PATCH_CODE" == "200" ]] && ok "PATCH /api/v1/settings/context" || bad "PATCH settings/context" "HTTP $PATCH_CODE $(head -c 200 /tmp/settings_patch.json)"

echo "=== 7. MCP cross-user isolation ==="
if [[ -n "$DOC_A_ID" && -n "$TOKEN_B" ]]; then
  INIT_B=$(curl -s -D /tmp/mcp_b_hdrs.txt -o /tmp/mcp_b_init.txt -w '%{http_code}' -X POST "$MCP" \
    -H "Authorization: Bearer $TOKEN_B" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"vb","version":"1"}}}')
  SID_B=$(rg -i '^mcp-session-id:' /tmp/mcp_b_hdrs.txt | awk '{print $2}' | tr -d '\r')
  if [[ "$INIT_B" == "200" && -n "$SID_B" ]]; then
    curl -s -X POST "$MCP" \
      -H "Authorization: Bearer $TOKEN_B" \
      -H "mcp-session-id: $SID_B" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
    DENY=$(curl -s -X POST "$MCP" \
      -H "Authorization: Bearer $TOKEN_B" \
      -H "mcp-session-id: $SID_B" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"read_file\",\"arguments\":{\"document_id\":\"$DOC_A_ID\"}}}")
    if echo "$DENY" | grep -qi 'document_not_found\|not found\|isError.*true\|"isError":true'; then
      ok "MCP user B denied read_file on user A doc"
    else
      bad "MCP cross-user deny" "$(echo "$DENY" | head -c 400)"
    fi
  else
    bad "MCP user B initialize" "HTTP $INIT_B"
  fi
else
  skip "MCP cross-user isolation" "no DOC_A_ID or TOKEN_B"
fi

echo
echo "======== SUMMARY ========"
printf '%s\n' "${RESULTS[@]}"
echo "-------------------------"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[[ "$FAIL" -eq 0 ]]
