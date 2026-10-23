import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <article className="max-w-[62ch] pt-14 text-[17px] leading-relaxed">
      <h1 className="font-display text-4xl font-bold">About</h1>
      <p className="mt-6">
        Every review here is a real message from the Prof. Evaluation topic of the NU student Telegram chat, written
        between 2023 and 2026. The chat is great for asking but hard to search, so this site groups the answers by
        professor and course.
      </p>
      <h2 className="mt-10 text-lg font-semibold">How it was put together</h2>
      <p className="mt-3">
        Messages were grouped into threads, so a short answer like “Самат норм” keeps the question it replied to. A
        language model then picked out which professor and course each answer was about, and wrote the one line English
        summary under it. Those summaries and tags can be wrong. The original message is always shown above them, so
        trust that first.
      </p>
      <p className="mt-3">
        Names were merged automatically. When people only wrote a first name, the page is labelled with the department,
        like “Aigerim (MATH)”, because it may cover more than one person.
      </p>
      <h2 className="mt-10 text-lg font-semibold">Privacy and removals</h2>
      <p className="mt-3">
        Authors are never shown. If you wrote a message and want it removed, or you think a review is unfair or
        assigned to the wrong person, write to the maintainers and it will be taken down.
      </p>
    </article>
  );
}
