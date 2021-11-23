import type { LoaderFunction } from "remix";
import { db } from "~/utils/db.server";
import { getUserId } from "~/utils/session.server";

export let loader: LoaderFunction = async ({ request }) => {
  let userId = await getUserId(request);
  let jokes = userId
    ? await db.joke.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { jokester: { select: { username: true } } },
        where: { jokesterId: userId },
      })
    : [];

  const host =
    request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");
  if (!host) {
    throw new Error("Could not determine domain URL.");
  }
  const protocol = host.includes("localhost") ? "http" : "https";
  let domain = `${protocol}://${host}`;
  const jokesUrl = `${domain}/jokes`;

  let rssString = `
    <rss xmlns:blogChannel="${jokesUrl}" version="2.0">
      <channel>
        <title>Dad Jokes</title>
        <link>${jokesUrl}</link>
        <description>Some dad jokes</description>
        <language>en-us</language>
        <generator>Roman Jasiek</generator>
        <ttl>40</ttl>
        ${jokes
          .map((joke) =>
            `
            <item>
              <title>${joke.name}</title>
              <description>A funny joke called ${joke.name}</description>
              <author>${joke.jokester.username}</author>
              <pubDate>${joke.createdAt}</pubDate>
              <link>${jokesUrl}/${joke.id}</link>
              <guid>${jokesUrl}/${joke.id}</guid>
            </item>
          `.trim()
          )
          .join("\n")}
      </channel>
    </rss>
  `.trim();

  return new Response(rssString, {
    headers: {
      "Cache-Control": `public, max-age=${60 * 10}, s-maxage=${60 * 60 * 24}`,
      "Content-Type": "application/xml",
      "Content-Length": String(Buffer.byteLength(rssString)),
    },
  });
};