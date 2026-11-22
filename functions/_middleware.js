export async function onRequest(context) {
  const country = context.request.cf?.country;

  // ローカル開発時（countryがundefinedになる場合）は通す
  if (!country) {
    return await context.next();
  }

  // 日本（JP）以外からのアクセスはすべて拒否
  if (country !== "JP") {
    return new Response("Access denied (Japan only).", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  // 日本からのアクセスなら通常通りページやAPIを表示
  return await context.next();
}