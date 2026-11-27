import { useEffect, useState } from 'react';
import { getStoreInfo } from '../api/selfOrder';
import { loadMidtransSnap } from '../utils/midtrans';
import { readableBrand } from '../utils/selfOrder';

/**
 * Info toko untuk halaman pelanggan + tema terang:
 * - --so-brand = warna tema owner, digelapkan bila perlu agar tombol bertulisan putih terbaca
 * - latar body krem (agar tidak terlihat gelap saat halaman ditarik/overscroll)
 */
export default function useSelfOrderStore() {
  const [storeInfo, setStoreInfo] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const prevBg = document.body.style.background;
    document.body.style.background = '#F5F3EE';
    let alive = true;
    getStoreInfo()
      .then(res => {
        if (!alive) return;
        setStoreInfo(res.data);
        root.style.setProperty('--so-brand', readableBrand(res.data.theme_color));
        if (res.data.store_name) document.title = res.data.store_name;
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
      root.style.removeProperty('--so-brand');
      document.body.style.background = prevBg;
    };
  }, []);

  useEffect(() => {
    if (storeInfo.midtrans_client_key) {
      loadMidtransSnap(storeInfo.midtrans_client_key, storeInfo.midtrans_is_production);
    }
  }, [storeInfo.midtrans_client_key, storeInfo.midtrans_is_production]);

  return { storeInfo, ready };
}
