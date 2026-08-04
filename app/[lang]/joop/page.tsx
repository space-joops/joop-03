import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";

export default async function JoopPage({ params }: PageProps<"/[lang]/joop">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  redirect(`/${lang}`);
}
