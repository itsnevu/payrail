import { ProseShell } from "@/components/prose/ProseShell";
import Kicker from "@/components/blog/Kicker";
import PostCard from "@/components/blog/PostCard";
import MoreFromPayrail, { MORE_LINKS } from "@/components/blog/MoreFromPayrail";
import { blogPosts } from "@/lib/content";

export const metadata = {
  title: "Blog: Payrail",
  description: "Notes on stablecoin payment reconciliation, and what we shipped.",
};

export default function BlogIndex() {
  // Newest first, from `content.ts`. The first one is featured.
  const posts = blogPosts();
  const [featured, ...rest] = posts;

  return (
    <ProseShell active="/blog">
      <div className="mx-auto w-full max-w-[1020px] px-5 py-14 sm:px-8 md:py-20">
        <header className="max-w-[64ch]">
          <Kicker>Blog</Kicker>
          <h1 className="mt-5 text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-ink sm:text-[48px] lg:text-[56px]">
            Notes on what shipped, and why.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-soft">
            Why &ldquo;I sent it, please check&rdquo; is a bigger problem than it looks, what we built to make it go
            away, and the decisions behind each release. Grounded in the code, not in a roadmap.
          </p>
          <div className="tnum mt-4 font-mono text-[12.5px] text-ink-faint">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </div>
        </header>

        {posts.length === 0 ? (
          <div className="surface-inset mt-12 rounded-[24px] p-6 text-[15px] text-ink-soft">Nothing published yet.</div>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 md:gap-5">
            <PostCard post={featured} featured />
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <MoreFromPayrail
          heading="Looking for the reference material?"
          lede="The blog explains decisions. The docs and the FAQ are where the facts live: what the contract does, what the app labels, and what is still missing."
          items={[MORE_LINKS.docs, MORE_LINKS.faq]}
        />
      </div>
    </ProseShell>
  );
}
