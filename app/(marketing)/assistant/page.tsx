import type {Metadata} from "next";
import Link from "next/link";
import {getRequestLocale} from "@/lib/i18n/server";
import styles from "../agency.module.css";
export const metadata:Metadata={title:"Existing assistant accounts — Bright Ears",robots:{index:false,follow:true}};
export default async function AssistantPage(){
 const th=(await getRequestLocale())==="th";
 return <section className={styles.accountPage}><p className={styles.eyebrow}><span/>{th?"สำหรับผู้ใช้เดิม":"For existing users"}</p><h1>{th?"บัญชีผู้ช่วย Bright Ears":"Your Bright Ears assistant account"}</h1>
 <p>{th?"Bright Ears กลับมาเน้นบริการดีเจเอเจนซี และปิดรับบัญชีผู้ช่วยและการสมัครสมาชิกใหม่แล้ว":"Bright Ears is focusing on its DJ agency. The artist assistant is closed to new accounts and new subscriptions."}</p>
 <p>{th?"ผู้ใช้เดิมยังเข้าสู่ระบบเพื่อดูข้อมูล ผลลัพธ์ และจัดการการเรียกเก็บเงินได้ การเปลี่ยนหน้าเว็บไซต์นี้ไม่ได้ยกเลิกการสมัครสมาชิกเดิม":"Existing users can still sign in to access their saved work, results and billing settings. This website change does not cancel an existing subscription."}</p>
 <div className={styles.accountLinks}><Link className={styles.primary} href="/dashboard" prefetch={false}>{th?"เข้าสู่บัญชีเดิม":"Sign in to your account"} ↗</Link><Link className={styles.textLink} href="/dashboard/settings#billing" prefetch={false}>{th?"จัดการการเรียกเก็บเงิน":"Manage billing"} ↗</Link></div>
 <p>{th?"เบต้าที่มีอยู่จะสิ้นสุดตามวันที่แสดงในบัญชี โดยไม่มีการต่ออายุเป็นแผนชำระเงินอัตโนมัติ":"Existing beta access follows the end date shown in your account and does not automatically become a paid subscription."}</p>
 <p>{th?"หากต้องการความช่วยเหลือเรื่องบัญชี โปรดติดต่อ":"For account help, contact"} <a href="mailto:info@brightears.io" className={styles.textLink}>info@brightears.io</a>.</p>
 <div className={styles.accountLinks}><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/dpa">Data processing</Link><Link href="/">Bright Ears agency ↗</Link></div></section>;
}
