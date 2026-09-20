import { notFound } from "next/navigation";
import { ProseShell } from "@/components/prose/ProseShell";
import Kicker from "@/components/blog/Kicker";
import PostMeta from "@/components/blog/PostMeta";
import PostNav from "@/components/blog/PostNav";
import MoreFromPayrail, { MORE_LINKS } from "@/components/blog/MoreFromPayrail";
import { stripLeadingH1 } from "@/components/prose/stripTitle";
import { Markdown } from "@/lib/markdown";
import { blogPost, blogPosts } from "@/lib/content";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return blogPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Params) {
  const post = blogPost(params.slug);
  if (!post) return { title: "Not found: Payrail" };
  return { title: `${post.title}: Payrail`, description: post.description };
}

export default function BlogPostPage({ params }: Params) {
  const { slug } = params;
  const post = blogPost(slug);
  if (!post) notFound();

  // `blogPosts()` is newest first, so the entry after this one was published before it.
  const posts = blogPosts();
  const index = posts.findIndex((p) => p.slug === slug);
  const prev = posts[index + 1];
  const next = posts[index - 1];

  // The body opens with the same `# Title` the header prints, so drop it before rendering.
  const body = stripLeadingH1(post.body);

  return (
    <ProseShell active="/blog">
      <div className="mx-auto w-full max-w-[72ch] px-5 py-14 sm:px-8 md:py-20">
        <article>
          <header>
            <Kicker href="/blog">Blog</Kicker>
            <h1 className="mt-5 text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[44px]">
              {post.title}
            </h1>
            {post.description && (
              <p className="mt-5 text-[17px] leading-[1.6] text-ink-soft sm:text-[18px]">{post.description}</p>
            )}
            <PostMeta date={post.date} minutes={post.minutes} className="mt-6 border-t border-line pt-5" />
          </header>

          <div className="mt-2">
            <Markdown source={body} />
          </div>
        </article>

        <PostNav prev={prev} next={next} />

        <MoreFromPayrail
          heading="Read the rest of the picture."
          items={[MORE_LINKS.docs, MORE_LINKS.whitepaper, MORE_LINKS.faq]}
        />
      </div>
    </ProseShell>
  );
}
