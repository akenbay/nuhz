import Link from "next/link";
import SearchBox from "@/components/SearchBox";

export default function NotFound() {
  return (
    <section className="pt-20">
      <h1 className="font-display text-4xl font-bold">No page here</h1>
      <p className="mt-4 text-muted">The link may be old. Search for the professor or course instead.</p>
      <div className="mt-6 max-w-xl">
        <SearchBox />
      </div>
      <Link href="/" className="mt-6 inline-block text-accent underline underline-offset-2">
        Go to the home page
      </Link>
    </section>
  );
}
