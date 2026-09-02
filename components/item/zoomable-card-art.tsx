"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ZoomIn } from "lucide-react";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Props {
  themeIndex: number;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number;
}

export function ZoomableCardArt(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className="group relative w-full"
      >
        <CardArt {...props} size="lg" />
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
          <ZoomIn className="size-8 text-white drop-shadow" />
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Zoomed digital twin artwork</DialogTitle>
          <CardArt {...props} size="lg" className="aspect-square" />
        </DialogContent>
      </Dialog>
    </>
  );
}
