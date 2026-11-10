import AiLabel from "@/components/trust/AiLabel";
import type { SupplierTrust } from "@/lib/trust/supplier-trust";

const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const percent = (value: number | null) => (value === null ? "—" : `${value}%`);

export default function SupplierTrustCard({ trust }: { trust: SupplierTrust }) {
  const { facts } = trust;
  return <section className="trust-card" aria-labelledby="trust-title">
    <div className="fair-head"><h2 id="trust-title">Rekam jejak {facts.nama}</h2>{trust.byModel && <AiLabel />}</div>
    <p className="trust-summary">{trust.summary}</p>
    <dl className="detail-rules">
      <dt>Verifikasi</dt><dd>{facts.terverifikasi ? "Diverifikasi manual oleh pengelola" : "Belum terverifikasi"}{facts.catatan_verifikasi && ` · ${facts.catatan_verifikasi}`}</dd>
      <dt>Batch selesai</dt><dd>{facts.batch_selesai}</dd>
      <dt>Batch berhasil</dt><dd>{percent(facts.persen_batch_berhasil)} dari {facts.batch_ditutup} batch yang ditutup</dd>
      <dt>Pesanan diserahkan</dt><dd>{percent(facts.persen_pesanan_diserahkan)} dari {facts.pesanan_batch_berhasil} pesanan di batch berhasil</dd>
      <dt>Bergabung</dt><dd>{date.format(new Date(`${facts.bergabung}T00:00:00+07:00`))}</dd>
    </dl>
    <small>{trust.byModel ? "Ringkasan ditulis AI hanya dari fakta di tabel ini; angka yang tidak ada di fakta ditolak." : "Ringkasan dibuat otomatis dari fakta di tabel ini."}</small>
  </section>;
}
