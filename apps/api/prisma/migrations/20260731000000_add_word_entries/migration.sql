-- CreateTable
CREATE TABLE "word_entries" (
    "post_id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "translation" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "word_entries_pkey" PRIMARY KEY ("post_id")
);

-- AddForeignKey
ALTER TABLE "word_entries" ADD CONSTRAINT "word_entries_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
