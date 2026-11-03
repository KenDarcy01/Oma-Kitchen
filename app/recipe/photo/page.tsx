import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorGate } from "@/components/EditorGate";
import { PhotoStudioPage } from "@/components/PhotoStudio";

export const metadata: Metadata = { title: "Photo studio" };

export default function Page() {
  return (
    <div className="wrap">
      <EditorGate>
        <Suspense>
          <PhotoStudioPage />
        </Suspense>
      </EditorGate>
    </div>
  );
}
