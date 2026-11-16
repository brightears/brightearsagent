import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {previewCatalogueArtist} from "@/lib/agency/catalogue";
import {getRequestLocale} from "@/lib/i18n/server";
import {ArtistProfile} from "@/components/artist-profile";

export const dynamic="force-dynamic";
// Private link for the artist's check: never indexed, and the token is not sent onward in a Referer header.
export const metadata:Metadata={title:"Profile preview — Bright Ears",robots:{index:false,follow:false,nocache:true},referrer:"no-referrer"};

export default async function CataloguePreviewPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const preview=await previewCatalogueArtist(token).catch(()=>null);
 if(!preview) notFound();
 const th=(await getRequestLocale())==="th";
 return <ArtistProfile artist={preview.artist} related={[]} th={th} preview={preview.status}/>;
}
