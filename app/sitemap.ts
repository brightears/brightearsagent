import type {MetadataRoute} from "next";
import {appUrlLenient} from "@/lib/app-url";
/** The agency homepage is the public offering. Account and retired SaaS
 * acquisition routes intentionally do not belong in the search index. */
export default function sitemap():MetadataRoute.Sitemap {
 return [{url:appUrlLenient(),lastModified:new Date("2026-09-09"),changeFrequency:"monthly",priority:1}];
}
