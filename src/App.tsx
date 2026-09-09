import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, Loader2, Trash2, Globe, Brain, RefreshCw, Save,
  Facebook, Instagram, Wifi, WifiOff, Inbox, Layers, Send, MapPin, X, Check,
} from 'lucide-react';
import { supabase, TRAIN_FB_FUNCTION_URL, CHAT_FUNCTION_URL, type Marca, type BrandChannel, type Mensaje } from '@/supabase';

type View = 'marcas' | 'inbox';

const FB_APP_ID = import.meta.env.VITE_FB_APP_ID;

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) { resolve(); return; }
    window.fbAsyncInit = () => {
      window.FB!.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      });
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    script.onload = () => { if (window.FB) resolve(); };
    document.head.appendChild(script);
  });
}

function App() {
  const [view, setView] = useState<View>('marcas');
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [channels, setChannels] = useState<BrandChannel[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedMarca, setSelectedMarca] = useState<Marca | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [m, c, msg] = await Promise.all([
      supabase.from('marcas').select('*').order('created_at', { ascending: false }),
      supabase.from('brand_channels').select('*').order('created_at', { ascending: false }),
      supabase.from('mensajes').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (m.data) setMarcas(m.data);
    if (c.data) setChannels(c.data);
    if (msg.data) setMensajes(msg.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    loadFacebookSDK().catch(() => {});
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-slate-100">
      <header className="border-b border-slate-800/60 bg-[#0d0e14] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 grid place-items-center">
              <MessageSquare size={18} className="text-white" />
            </div>
            <h1 className="text-base font-semibold tracking-tight">Centro de Mensajes</h1>
          </div>
          <nav className="flex gap-1">
            <button onClick={() => setView('marcas')} className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${view === 'marcas' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
              <Layers size={15} /> Marcas
            </button>
            <button onClick={() => setView('inbox')} className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${view === 'inbox' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
              <Inbox size={15} /> Inbox
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm"><Loader2 size={18} className="animate-spin" /> Cargando...</div>
        ) : view === 'marcas' ? (
          <MarcasView marcas={marcas} channels={channels} showToast={showToast} onDataChange={fetchData} onOpenMarca={(m) => setSelectedMarca(m)} />
        ) : (
          <InboxView mensajes={mensajes} marcas={marcas} />
        )}
      </div>

      {selectedMarca && (
        <MarcaDetail
          marca={selectedMarca}
          channels={channels.filter((c) => c.brand_id === selectedMarca.id)}
          showToast={showToast}
          onDataChange={fetchData}
          onClose={() => setSelectedMarca(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg shadow-lg z-30">{toast}</div>
      )}
    </div>
  );
}

function MarcasView({ marcas, channels, showToast, onDataChange, onOpenMarca }: {
  marcas: Marca[]; channels: BrandChannel[]; showToast: (m: string) => void; onDataChange: () => void; onOpenMarca: (m: Marca) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { showToast('Falta el nombre de la marca'); return; }
    if (!url.trim()) { showToast('Falta la URL'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('marcas').insert({
        nombre: nombre.trim(),
        website_url: url.trim(),
      });
      if (error) throw error;
      showToast('Marca guardada');
      setNombre('');
      setUrl('');
      onDataChange();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMarca(marca: Marca) {
    if (!confirm(`¿Eliminar "${marca.nombre}"?`)) return;
    const { error } = await supabase.from('marcas').delete().eq('id', marca.id);
    if (error) { showToast('Error'); return; }
    showToast('Marca eliminada');
    onDataChange();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Nueva Marca</h2>
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1.5">Nombre de la marca</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Mi Empresa" className="w-full px-3.5 py-2.5 bg-[#11131a] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs text-slate-500 mb-1.5">URL (opcional, no se scrapea)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://miempresa.com" className="w-full px-3.5 py-2.5 bg-[#11131a] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Marcas ({marcas.length})</h2>
        {marcas.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No hay marcas. Crea la primera arriba.</div>
        ) : (
          <div className="grid gap-3">
            {marcas.map((marca) => {
              const marcaChannels = channels.filter((c) => c.brand_id === marca.id);
              const fbConnected = marcaChannels.some((c) => c.channel_type === 'facebook' && c.connected);
              return (
                <div key={marca.id} className="bg-[#11131a] border border-slate-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onOpenMarca(marca)} className="text-slate-100 font-medium hover:text-blue-400 transition-colors text-left">
                        {marca.nombre || 'Sin nombre'}
                      </button>
                      {marca.website_url && (
                        <a href={marca.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-0.5">
                          <Globe size={11} /> {marca.website_url}
                        </a>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Brain size={12} /> {marca.entrenada ? 'Entrenada' : 'Sin entrenar'}
                        </span>
                        {marca.last_trained_at && (
                          <span className="text-slate-600">
                            {new Date(marca.last_trained_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Facebook size={12} className={fbConnected ? 'text-blue-400' : 'text-slate-700'} /> {fbConnected ? 'FB conectado' : 'FB sin conectar'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onOpenMarca(marca)} className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md">Abrir</button>
                      <button onClick={() => deleteMarca(marca)} className="text-slate-600 hover:text-red-400 p-1.5"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FacebookPagePicker({ pages, onPick, onClose }: {
  pages: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }[];
  onPick: (page: { id: string; name: string; access_token: string }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#11131a] border border-slate-700 rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Selecciona la pagina para esta marca</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => onPick({ id: page.id, name: page.name, access_token: page.access_token })}
              className="w-full flex items-center gap-3 p-3 bg-[#0a0b0f] border border-slate-800 hover:border-blue-500 rounded-lg text-left transition-colors"
            >
              {page.picture?.data?.url ? (
                <img src={page.picture.data.url} alt={page.name} className="w-9 h-9 rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-600 grid place-items-center"><Facebook size={18} className="text-white" /></div>
              )}
              <span className="text-sm text-slate-200 flex-1">{page.name}</span>
              <Check size={16} className="text-slate-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarcaDetail({ marca, channels, showToast, onDataChange, onClose }: {
  marca: Marca; channels: BrandChannel[]; showToast: (m: string) => void; onDataChange: () => void; onClose: () => void;
}) {
  const [editNombre, setEditNombre] = useState(marca.nombre);
  const [editUrl, setEditUrl] = useState(marca.website_url);
  const [editKnowledge, setEditKnowledge] = useState(marca.training_data || marca.knowledge_base || '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const [fbPages, setFbPages] = useState<any[] | null>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ dir: 'user' | 'bot'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const fbChannel = channels.find((c) => c.channel_type === 'facebook');

  async function saveInfo() {
    if (!editNombre.trim()) { showToast('El nombre no puede estar vacio'); return; }
    setSavingInfo(true);
    try {
      const { error } = await supabase.from('marcas').update({
        nombre: editNombre.trim(),
        website_url: editUrl.trim(),
      }).eq('id', marca.id);
      if (error) throw error;
      showToast('Marca guardada');
      onDataChange();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingInfo(false);
    }
  }

  async function saveKnowledge() {
    setSavingKnowledge(true);
    try {
      const { error } = await supabase.from('marcas').update({
        training_data: editKnowledge,
        entrenada: editKnowledge.trim().length > 0,
      }).eq('id', marca.id);
      if (error) throw error;
      showToast('Conocimiento guardado');
      onDataChange();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingKnowledge(false);
    }
  }

  async function trainFromFacebook() {
    if (!fbChannel || !fbChannel.connected) {
      showToast('Primero conecta Facebook');
      return;
    }
    setTraining(true);
    setTrainProgress(10);
    try {
      setTrainProgress(30);
      const res = await fetch(TRAIN_FB_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: marca.id }),
      });
      setTrainProgress(70);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al entrenar');
      setEditKnowledge(data.marca?.training_data || '');
      setTrainProgress(100);
      showToast(`Entrenada con ${data.postsCount || 0} publicaciones`);
      onDataChange();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    } finally {
      setTraining(false);
      setTimeout(() => setTrainProgress(0), 1500);
    }
  }

  function loginFacebook() {
    if (!window.FB) { showToast('Facebook SDK no cargado'); return; }
    setFbLoading(true);
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken;
        window.FB.api('/me/accounts', 'get', { access_token: accessToken, fields: 'id,name,access_token,picture.width(64).height(64)' }, (pagesRes: any) => {
          setFbLoading(false);
          if (pagesRes.data && pagesRes.data.length > 0) {
            setFbPages(pagesRes.data);
          } else {
            showToast('No se encontraron paginas. Necesitas ser admin de una pagina.');
          }
        });
      } else {
        setFbLoading(false);
        showToast('Login cancelado');
      }
    }, { scope: 'pages_show_list,pages_read_engagement,pages_read_user_content' });
  }

  async function pickFacebookPage(page: { id: string; name: string; access_token: string }) {
    setFbPages(null);
    try {
      if (fbChannel) {
        const { error } = await supabase.from('brand_channels').update({
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
          connected: true,
        }).eq('id', fbChannel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('brand_channels').insert({
          brand_id: marca.id,
          channel_type: 'facebook',
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
          connected: true,
        });
        if (error) throw error;
      }
      showToast(`Facebook conectado: ${page.name}`);
      onDataChange();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error');
    }
  }

  async function disconnectFacebook() {
    if (!fbChannel) return;
    const { error } = await supabase.from('brand_channels').update({ connected: false }).eq('id', fbChannel.id);
    if (error) { showToast('Error'); return; }
    showToast('Facebook desconectado');
    onDataChange();
  }

  async function sendChat(text: string) {
    if (!text.trim()) return;
    setChatMessages((prev) => [...prev, { dir: 'user', text }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch(CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marcaId: marca.id, mensaje: text, plataforma: 'webchat' }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { dir: 'bot', text: data.response || 'Error' }]);
    } catch {
      setChatMessages((prev) => [...prev, { dir: 'bot', text: 'Error de conexion' }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#11131a] border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-100">{marca.nombre || 'Sin nombre'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Cerrar</button>
        </div>

        {/* Info */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Informacion</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full px-3.5 py-2.5 bg-[#0a0b0f] border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">URL</label>
              <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="w-full px-3.5 py-2.5 bg-[#0a0b0f] border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:border-blue-500" />
            </div>
          </div>
          <button onClick={saveInfo} disabled={savingInfo} className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {savingInfo ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
          </button>
        </section>

        {/* Canales */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Canales</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fbChannel?.connected ? disconnectFacebook() : loginFacebook()}
              disabled={fbLoading}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-colors ${fbChannel?.connected ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-[#0a0b0f] text-slate-400 hover:border-blue-500'}`}
            >
              <Facebook size={16} /> Facebook
              {fbChannel?.connected ? <Wifi size={14} className="ml-auto" /> : fbLoading ? <Loader2 size={14} className="animate-spin ml-auto" /> : <WifiOff size={14} className="ml-auto" />}
            </button>
            {fbChannel?.connected && (
              <div className="text-xs text-slate-500 col-span-2 -mt-1 mb-1 px-1">
                Conectado: {fbChannel.page_name}
              </div>
            )}
            <button disabled className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-slate-800 bg-[#0a0b0f] text-slate-600 cursor-not-allowed opacity-50" title="Proximamente">
              <Instagram size={16} /> Instagram
              <WifiOff size={14} className="ml-auto" />
            </button>
            <button disabled className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-slate-800 bg-[#0a0b0f] text-slate-600 cursor-not-allowed opacity-50" title="Proximamente">
              <MessageSquare size={16} /> WhatsApp
              <WifiOff size={14} className="ml-auto" />
            </button>
            <button disabled className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-slate-800 bg-[#0a0b0f] text-slate-600 cursor-not-allowed opacity-50" title="Proximamente">
              <MessageSquare size={16} /> TikTok
              <WifiOff size={14} className="ml-auto" />
            </button>
          </div>
        </section>

        {/* Entrenar desde Facebook */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Entrenar desde Facebook</h3>
            <button onClick={trainFromFacebook} disabled={training || !fbChannel?.connected} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md">
              {training ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Entrenar
            </button>
          </div>
          {!fbChannel?.connected && (
            <p className="text-xs text-slate-600 mb-2">Primero conecta Facebook para poder entrenar</p>
          )}
          {trainProgress > 0 && (
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${trainProgress}%` }} />
            </div>
          )}
          {marca.entrenada && marca.last_trained_at && (
            <p className="text-xs text-slate-500">Ultimo entrenamiento: {new Date(marca.last_trained_at).toLocaleString('es-MX')}</p>
          )}
        </section>

        {/* Conocimiento */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Base de Conocimiento</h3>
          </div>
          <textarea value={editKnowledge} onChange={(e) => setEditKnowledge(e.target.value)} rows={8} placeholder="El conocimiento se llena al entrenar desde Facebook, o puedes escribirlo manualmente..." className="w-full px-3.5 py-2.5 bg-[#0a0b0f] border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:border-blue-500 resize-y font-mono" />
          <button onClick={saveKnowledge} disabled={savingKnowledge} className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {savingKnowledge ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
          </button>
        </section>

        {/* Probar cerebro */}
        <section>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Probar Cerebro</h3>
          <div className="bg-[#0a0b0f] border border-slate-800 rounded-lg p-3 h-48 overflow-y-auto space-y-2 mb-2">
            {chatMessages.length === 0 && <p className="text-slate-600 text-sm text-center py-8">Envia un mensaje para probar el cerebro de esta marca</p>}
            {chatMessages.map((m, i) => (
              <div key={i} className={`text-sm px-3 py-1.5 rounded-lg max-w-[80%] ${m.dir === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-slate-800 text-slate-200'}`}>{m.text}</div>
            ))}
            {chatLoading && <div className="text-slate-500 text-sm px-3"><Loader2 size={14} className="animate-spin inline" /> escribiendo...</div>}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(chatInput)} placeholder="Escribe..." className="flex-1 px-3 py-2 bg-[#0a0b0f] border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:border-blue-500" />
            <button onClick={() => sendChat(chatInput)} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"><Send size={16} /></button>
          </div>
        </section>
      </div>

      {fbPages && (
        <FacebookPagePicker
          pages={fbPages}
          onPick={pickFacebookPage}
          onClose={() => setFbPages(null)}
        />
      )}
    </div>
  );
}

function InboxView({ mensajes, marcas }: { mensajes: Mensaje[]; marcas: Marca[] }) {
  const [filtroMarca, setFiltroMarca] = useState<string>('all');

  const filtrados = useMemo(() => {
    if (filtroMarca === 'all') return mensajes;
    return mensajes.filter((m) => m.marca_id === filtroMarca);
  }, [mensajes, filtroMarca]);

  function getMarcaNombre(marcaId: string): string {
    return marcas.find((m) => m.id === marcaId)?.nombre || 'Sin marca';
  }

  const plataformaColor = (p: string): string => {
    const colors: Record<string, string> = { facebook: '#1877f2', instagram: '#e1306c', whatsapp: '#25d366', tiktok: '#000000', webchat: '#10b981' };
    return colors[p] || '#64748b';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Mensajes ({filtrados.length})</h2>
        <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className="px-3 py-2 bg-[#11131a] border border-slate-800 rounded-lg text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer">
          <option value="all">Todas las marcas</option>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre || 'Sin nombre'}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="py-12 text-center text-slate-600 text-sm">No hay mensajes.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((msg) => (
            <div key={msg.id} className="bg-[#11131a] border border-slate-800 rounded-lg p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-slate-300">{getMarcaNombre(msg.marca_id)}</span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ color: plataformaColor(msg.plataforma), background: `${plataformaColor(msg.plataforma)}15` }}>
                  {msg.plataforma}
                </span>
                <small className="text-slate-600 ml-auto">{new Date(msg.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-400"><span className="text-slate-600 text-xs">Cliente:</span> {msg.mensaje_in}</div>
                <div className="text-sm text-slate-200"><span className="text-slate-600 text-xs">Bot:</span> {msg.respuesta_out}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
