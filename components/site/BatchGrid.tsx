"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import OrderForm from "@/components/OrderForm";
import Icon from "@/components/site/Icon";
import Modal from "@/components/site/Modal";
import { daysLeft, formatQuantity, percentOf, resolveTiers, rupiah, type Batch } from "@/lib/batch";

function BatchCard({ batch, index, onJoin }: { batch: Batch; index: number; onJoin: () => void }) {
  const percent = percentOf(batch);
  const { current, next } = resolveTiers(batch);
  const badge = batch.current < batch.minimum ? `Butuh ${formatQuantity(batch.minimum - batch.current)} ${batch.unit} lagi` : next ? `Harga turun di ${formatQuantity(next.minQuantity)} ${batch.unit}` : "Harga terbaik tercapai";
  return <article className="product-card" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
    <Link className="product-image" href={`/patungan/${batch.id}`} style={{ backgroundColor: batch.color }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL gambar dari admin, domain tidak tetap */}
      {batch.image && <img src={batch.image} alt={batch.name} loading="lazy" />}
      <span className={percent >= 80 ? "product-badge badge-hot" : "product-badge"}>{badge}</span>
    </Link>
    <div className="product-content">
      <div className="product-meta"><span>{batch.category}</span><span className="days"><Icon name="clock" size={13} /> {daysLeft(batch.closesAt)} hari lagi</span></div>
      <h3><Link href={`/patungan/${batch.id}`}>{batch.name}</Link></h3>
      <div className="supplier-line">{batch.verified && <span className="supplier-check"><Icon name="check" size={10} /></span>}<span>{batch.supplier}</span><span className={batch.verified ? "verified-word" : "verified-word unverified"}>{batch.verified ? "Terverifikasi" : "Belum terverifikasi"}</span></div>
      <div className="price-row">
        <div className="price">{rupiah(current?.unitPrice ?? 0)}<span>/{batch.unit}</span></div>
        {next && <div className="next-price">turun ke <b>{rupiah(next.unitPrice)}</b> di {formatQuantity(next.minQuantity)} {batch.unit}</div>}
      </div>
      <div className="card-progress">
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        <div className="progress-caption"><span><b>{formatQuantity(batch.current)}</b> / {formatQuantity(batch.minimum)} {batch.unit}</span><span>{percent}%</span></div>
      </div>
      <button className="join-button" onClick={onJoin}>Gabung patungan <Icon name="bag" size={15} /></button>
    </div>
  </article>;
}

/** Grid kartu batch dengan dialog pesanan bersama. */
export default function BatchGrid({ batches, whatsappNumber, columns = 4 }: { batches: Batch[]; whatsappNumber?: string; columns?: 3 | 4 }) {
  const [selected, setSelected] = useState<Batch | null>(null);
  const close = useCallback(() => setSelected(null), []);
  return <>
    <div className={columns === 3 ? "product-grid product-grid-3" : "product-grid"}>
      {batches.map((batch, index) => <BatchCard key={batch.id} batch={batch} index={index} onJoin={() => setSelected(batch)} />)}
    </div>
    {selected && <Modal onClose={close} labelledBy="modal-title">
      <div className="modal-eyebrow">GABUNG BATCH MINGGU INI</div><h2 id="modal-title">Ikut patungan<br /><em>{selected.name}</em></h2>
      <p className="modal-copy">Komitmen pesananmu membantu membuka harga grosir. Pembayaran baru diminta setelah batch mencapai kuota minimum. <Link href={`/patungan/${selected.id}`}>Lihat detail & tier harga →</Link></p>
      <OrderForm key={selected.id} batch={selected} whatsappNumber={whatsappNumber} onDone={close} />
    </Modal>}
  </>;
}

/** Tombol pembuka dialog untuk satu batch (dipakai di banner hitung mundur). */
export function JoinButton({ batch, whatsappNumber, label }: { batch: Batch; whatsappNumber?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button className="button button-dark" onClick={() => setOpen(true)}>{label} <Icon name="arrow" size={16} /></button>
    {open && <Modal onClose={close} labelledBy="modal-title">
      <div className="modal-eyebrow">GABUNG BATCH</div><h2 id="modal-title">Ikut patungan<br /><em>{batch.name}</em></h2>
      <OrderForm batch={batch} whatsappNumber={whatsappNumber} onDone={close} />
    </Modal>}
  </>;
}
