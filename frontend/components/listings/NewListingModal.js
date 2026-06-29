'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';

const STEPS = ['Informações', 'Fotos', 'Revisão'];

function ImageDropzone({ images, setImages }) {
  const [uploading, setUploading] = useState(false);
  const { t } = useI18n();

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of accepted.slice(0, 5)) {
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(
          (process.env.NEXT_PUBLIC_API_URL || '/api') + '/listings/upload-image',
          { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd }
        );
        const data = await res.json();
        if (data.url) uploaded.push(data.url);
      } catch {}
    }
    setImages(prev => [...prev, ...uploaded].slice(0, 5));
    setUploading(false);
  }, [setImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 5,
    maxSize: 8 * 1024 * 1024,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-moss bg-moss-light/30'
            : 'border-[var(--border-c)] hover:border-moss hover:bg-cream2'
        }`}>
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">{uploading ? '⏳' : isDragActive ? '📂' : '📷'}</div>
        <p className="text-sm font-medium text-soil">
          {uploading ? t('Enviando...') : isDragActive ? t('Solte as fotos aqui') : t('Arraste fotos ou clique para selecionar')}
        </p>
        <p className="text-xs text-text3 mt-1">{t('Até 5 fotos · JPG, PNG, WebP · Máx 8 MB cada')}</p>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <AnimatePresence>
            {images.map((url, i) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: .8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: .8 }}
                className="relative group">
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-[var(--border-c)]" />
                <button
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rust text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  ✕
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] bg-moss text-white px-1 rounded font-semibold">{t('Capa')}</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function NewListingModal({ onClose, onCreated }) {
  const toast = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({
    title: '', category: 'graos', unit: 'saca',
    price: '', quantity_available: '', city: '', state: '', description: '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function nextStep() {
    if (step === 0) {
      if (!form.title || !form.price || !form.city || !form.state)
        return toast(t('Preencha os campos obrigatórios'), 'error');
    }
    setStep(s => Math.min(s + 1, 2));
  }

  async function submit() {
    setLoading(true);
    try {
      await api('/listings', 'POST', {
        ...form,
        price:              parseFloat(form.price),
        quantity_available: parseFloat(form.quantity_available) || 0,
        state:              form.state.toUpperCase().slice(0, 2),
        images,
      });
      toast(t('Anúncio publicado com sucesso!'));
      onClose();
      onCreated?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="560px">
      <ModalHeader title={t('Publicar anúncio')} onClose={onClose} />

      {/* STEP INDICATOR */}
      <div className="flex items-center gap-0 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 text-xs font-medium ${i <= step ? 'text-moss' : 'text-text3'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i < step ? 'bg-moss text-white' : i === step ? 'bg-moss-light text-moss border-2 border-moss' : 'bg-cream2 text-text3'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="hidden sm:block">{t(s)}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-moss' : 'bg-[var(--border-c)]'}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: .2 }}>

          {/* STEP 0: INFO */}
          {step === 0 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('Título *')}</label>
                <input type="text" className="form-input" placeholder={t('Ex: Soja Safra 2025 — Tipo 1')}
                  value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('Categoria')}</label>
                  <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="graos">{t('Grãos & Cereais')}</option>
                    <option value="frutas">{t('Frutas & Hortaliças')}</option>
                    <option value="gado">{t('Pecuária')}</option>
                    <option value="maquinas">{t('Máquinas')}</option>
                    <option value="outros">{t('Outros')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('Unidade')}</label>
                  <select className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    <option value="saca">{t('Saca (60kg)')}</option>
                    <option value="kg">{t('Quilograma (kg)')}</option>
                    <option value="tonelada">{t('Tonelada')}</option>
                    <option value="cabeca">{t('Cabeça')}</option>
                    <option value="unidade">{t('Unidade')}</option>
                    <option value="caixa">{t('Caixa')}</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('Preço (R$) *')}</label>
                  <input type="number" className="form-input" placeholder="0,00" step="0.01" min="0"
                    value={form.price} onChange={e => set('price', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('Quantidade disponível')}</label>
                  <input type="number" className="form-input" placeholder="0"
                    value={form.quantity_available} onChange={e => set('quantity_available', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('Cidade *')}</label>
                  <input type="text" className="form-input" placeholder={t('Ex: Ribeirão Preto')}
                    value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('Estado (UF) *')}</label>
                  <input type="text" className="form-input" placeholder="SP" maxLength={2}
                    value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('Descrição')}</label>
                <textarea className="form-input min-h-[80px] resize-y" placeholder={t('Descreva a qualidade, variedade, condições de entrega...')}
                  value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 1: PHOTOS */}
          {step === 1 && (
            <div>
              <p className="text-sm text-text3 mb-4">{t('Adicione fotos do produto. Boas imagens aumentam as chances de venda.')}</p>
              <ImageDropzone images={images} setImages={setImages} />
            </div>
          )}

          {/* STEP 2: REVIEW */}
          {step === 2 && (
            <div>
              <div className="card-agro p-5 mb-4">
                <div className="font-serif text-lg font-bold text-soil mb-3">{form.title}</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['Categoria', form.category], ['Unidade', form.unit],
                    ['Preço', `R$ ${parseFloat(form.price || 0).toFixed(2)}`],
                    ['Quantidade', form.quantity_available || '—'],
                    ['Localização', `${form.city}/${form.state}`],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span className="text-text3">{t(l)}: </span>
                      <span className="font-medium text-soil">{v}</span>
                    </div>
                  ))}
                </div>
                {form.description && (
                  <p className="text-sm text-text2 mt-3 pt-3 border-t border-[var(--border-c)]">{form.description}</p>
                )}
                {images.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-[var(--border-c)]" />
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ {t('Ao publicar, seu anúncio passará por moderação automática.')}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* NAVIGATION */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button className="btn btn-ghost flex-1" onClick={() => setStep(s => s - 1)}>
            ← {t('Voltar')}
          </button>
        )}
        {step < 2 ? (
          <button className="btn btn-primary flex-1" onClick={nextStep}>
            {t('Próximo')} →
          </button>
        ) : (
          <button className="btn btn-primary flex-1" onClick={submit} disabled={loading}>
            {loading ? t('Publicando...') : `🌾 ${t('Publicar anúncio')}`}
          </button>
        )}
      </div>
    </Modal>
  );
}
