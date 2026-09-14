export default {
  async fetch(request, env, ctx) {
    // フロント（Pages）からの通信を許可するCORSヘッダー
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // 1. 全データ一括取得（LP初期ロード用）
      if (pathname === "/api/all") {
        const [
          profile,
          visual,
          shopTag,
          shop,
          scheduleTag,
          schedule,
          notice,
          movieLabel,
          movie,
          linkList,
          gallery
        ] = await Promise.all([
          env.DB.prepare("SELECT * FROM profile LIMIT 1").first(),
          env.DB.prepare("SELECT * FROM visual ORDER BY priority ASC").all(),
          env.DB.prepare("SELECT * FROM shopTag").all(),
          env.DB.prepare("SELECT * FROM shop ORDER BY priority ASC").all(),
          env.DB.prepare("SELECT * FROM scheduleTag").all(),
          env.DB.prepare("SELECT * FROM schedule WHERE is_active = 1 ORDER BY schedule_at ASC").all(),
          env.DB.prepare("SELECT * FROM notice WHERE status = 'published' ORDER BY created_at DESC").all(),
          env.DB.prepare("SELECT * FROM movieLabel ORDER BY priority ASC").all(),
          env.DB.prepare("SELECT * FROM movie WHERE is_active = 1").all(),
          env.DB.prepare("SELECT * FROM linkList ORDER BY priority ASC").all(),
          env.DB.prepare("SELECT * FROM gallery ORDER BY priority ASC").all(),
        ]);

        const responseData = {
          profile,
          visual: visual.results,
          shopTag: shopTag.results,
          shop: shop.results,
          scheduleTag: scheduleTag.results,
          schedule: schedule.results,
          notice: notice.results,
          movieLabel: movieLabel.results,
          movie: movie.results,
          linkList: linkList.results,
          gallery: gallery.results,
        };

        return Response.json(responseData, { headers: corsHeaders });
      }

      // 2. テーブルごとの個別取得（例: /api/profile, /api/notice など）
      const allowedTables = [
        "profile", "visual", "shopTag", "shop", "scheduleTag",
        "schedule", "notice", "movieLabel", "movie", "linkList", "gallery"
      ];
      
      const match = pathname.match(/^\/api\/([a-zA-Z0-9_-]+)$/);
      if (match && allowedTables.includes(match[1])) {
        const tableName = match[1];
        const { results } = await env.DB.prepare(`SELECT * FROM ${tableName}`).all();
        return Response.json(results, { headers: corsHeaders });
      }

      // 3. データ保存・更新（POST /api/save-all）
      if (request.method === "POST" && pathname === "/api/save-all") {
        const body = await request.json();
        // D1が存在する場合はトランザクション実行等が可能
        return Response.json({ success: true, message: "Saved successfully" }, { headers: corsHeaders });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};