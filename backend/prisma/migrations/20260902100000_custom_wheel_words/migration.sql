-- Свої слова на колесі: позначка, що запис створено на сторінці колеса
-- і його не треба показувати в бібліотеці «Мої фільми».
ALTER TABLE "Movie" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;
