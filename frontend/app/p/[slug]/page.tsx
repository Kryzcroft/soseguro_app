"use client";

import { useParams } from "next/navigation";
import { PublicProfileView } from "../../../components/public/PublicProfileView";

export default function PublicMedicalProfilePage() {
  const params = useParams<{ slug: string }>();
  const publicId = params?.slug ?? "";

  return <PublicProfileView publicId={publicId} />;
}
