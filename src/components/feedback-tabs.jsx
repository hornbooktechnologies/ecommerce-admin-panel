import Link from 'next/link';
import styles from './catalog-tabs.module.css';
export function FeedbackTabs({seller=false}){return <nav aria-label="Rating sections" className={`catalog-tabs ${styles.tabs}`}><Link href="/admin/ratings" aria-current={!seller?'page':undefined} data-active={!seller||undefined}>Product reviews</Link><Link href="/admin/seller-ratings" aria-current={seller?'page':undefined} data-active={seller||undefined}>Seller ratings</Link></nav>;}
