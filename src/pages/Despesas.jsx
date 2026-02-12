import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Despesas() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [categorias, setCategorias] = useState([])
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(null)

  const [tipo, setTipo] = useState('Fixa')
  const [categoria, setCategoria] = useState('')
  const [categoriaNova, setCategoriaNova] = useState('')
  const [categoriaModo, setCategoriaModo] = useState('select')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [historico, setHistorico] = useState([])
  const [historicoBusca, setHistoricoBusca] = useState('')
  const [historicoTipo, setHistoricoTipo] = useState('')
  const [historicoCategoria, setHistoricoCategoria] = useState('')
  const [historicoDataInicial, setHistoricoDataInicial] = useState('')
  const [historicoDataFinal, setHistoricoDataFinal] = useState('')

  const fmtMT = (v) => {
    try {
      return `MT ${new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0))}`
    } catch {
      return `MT ${v}`
    }
  }

  const todayYMD = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const parsedValor = useMemo(() => {
    if (valor === '' || valor == null) return null
    const v = Number(String(valor).replace(',', '.'))
    return Number.isFinite(v) ? v : null
  }, [valor])

  const displayedItems = useMemo(() => items.slice(0, 5), [items])

  async function loadCategorias() {
    try {
      const data = await api.getCategoriasDespesa()
      const arr = Array.isArray(data) ? data : []
      setCategorias(arr)
      if (categoriaModo === 'select' && !categoria && arr.length > 0) setCategoria(arr[0].nome)
    } catch {
      setCategorias([])
    }
  }

  async function loadListAndTotal() {
    setLoading(true)
    setError('')
    try {
      const [list, totalRes] = await Promise.all([
        api.getDespesas({ fechada: 0 }),
        api.getDespesasTotal({ fechada: 0 }),
      ])
      setItems(Array.isArray(list) ? list : [])
      setTotal(totalRes?.total ?? null)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar')
      setItems([])
      setTotal(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategorias()
    loadListAndTotal()
  }, [])

  async function ensureCategoriaExists(nome) {
    const trimmed = (nome || '').trim()
    if (!trimmed) return false
    const exists = categorias.some((c) => String(c?.nome || '').toLowerCase() === trimmed.toLowerCase())
    if (exists) return true
    try {
      await api.createCategoriaDespesa(trimmed)
      await loadCategorias()
      return true
    } catch {
      return false
    }
  }

  function startEdit(item) {
    setEditingId(item?.id || null)
    setTipo(item?.tipo || 'Fixa')
    setCategoria(item?.categoria || '')
    setCategoriaNova('')
    setCategoriaModo('select')
    setDescricao(item?.descricao || '')
    setValor(item?.valor != null ? String(item.valor) : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setTipo('Fixa')
    setCategoriaNova('')
    setCategoriaModo('select')
    setDescricao('')
    setValor('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const categoriaFinal = categoriaModo === 'nova' ? categoriaNova : categoria
    if (!categoriaFinal) {
      setError('Categoria é obrigatória')
      return
    }
    if (!descricao.trim()) {
      setError('Descrição é obrigatória')
      return
    }
    if (parsedValor == null) {
      setError('Valor inválido')
      return
    }

    setSaving(true)
    try {
      await ensureCategoriaExists(categoriaFinal)
      const payload = {
        tipo,
        categoria: categoriaFinal,
        descricao: descricao.trim(),
        valor: parsedValor,
        status: 'Pago',
        data_pagamento: todayYMD(),
        data_vencimento: todayYMD(),
      }
      if (editingId) {
        await api.updateDespesa(editingId, payload)
      } else {
        await api.createDespesa(payload)
      }
      resetForm()
      await loadListAndTotal()
    } catch (ex) {
      setError(ex?.message || 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function askDelete(id) {
    setDeleteId(id)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      await api.deleteDespesa(deleteId)
      setDeleteOpen(false)
      setDeleteId(null)
      await loadListAndTotal()
    } catch (e) {
      setError(e?.message || 'Falha ao excluir')
    } finally {
      setDeleteLoading(false)
    }
  }

  const historicoFiltrado = useMemo(() => {
    const t = (historicoBusca || '').trim().toLowerCase()
    return historico.filter((d) => {
      if (historicoTipo && d?.tipo !== historicoTipo) return false
      if (historicoCategoria && d?.categoria !== historicoCategoria) return false

      const dp = d?.data_pagamento || ''
      if (historicoDataInicial && dp && dp < historicoDataInicial) return false
      if (historicoDataFinal && dp && dp > historicoDataFinal) return false

      if (!t) return true
      const s = `${d?.id || ''} ${d?.descricao || ''} ${d?.categoria || ''} ${d?.tipo || ''} ${d?.data_pagamento || ''}`
      return s.toLowerCase().includes(t)
    })
  }, [historico, historicoBusca, historicoTipo, historicoCategoria, historicoDataInicial, historicoDataFinal])

  async function openHistorico() {
    setHistoricoOpen(true)
    setHistoricoBusca('')
    setHistoricoTipo('')
    setHistoricoCategoria('')
    setHistoricoDataInicial('')
    setHistoricoDataFinal('')
    setHistoricoLoading(true)
    try {
      const data = await api.getDespesasHistorico({ limit: 500 })
      setHistorico(Array.isArray(data) ? data : [])
    } catch {
      setHistorico([])
    } finally {
      setHistoricoLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Despesas</h1>
        <div className="flex items-center gap-2">
          <div className="rounded-xl px-4 py-2 border bg-white shadow-sm">
            <div className="text-xs text-gray-600">Total (abertas)</div>
            <div className="text-lg font-semibold">{total == null ? '—' : fmtMT(total)}</div>
          </div>
          <button type="button" className="btn-outline" onClick={loadListAndTotal} disabled={loading}>Atualizar</button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Tipo</label>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="Fixa">Fixa</option>
              <option value="Variável">Variável</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Categoria</label>
            {categoriaModo === 'select' ? (
              <select
                className="input"
                value={categoria}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__nova__') {
                    setCategoriaModo('nova')
                    setCategoriaNova('')
                    return
                  }
                  setCategoria(v)
                }}
              >
                <option value="" disabled>Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
                <option value="__nova__">Adicionar categoria...</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  value={categoriaNova}
                  onChange={(e) => setCategoriaNova(e.target.value)}
                  placeholder="Nova categoria"
                />
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setCategoriaModo('select')
                    if (categoriaNova.trim()) setCategoria(categoriaNova.trim())
                  }}
                >
                  OK
                </button>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600">Descrição</label>
            <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição da despesa" />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Valor (MT)</label>
            <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {editingId && (
            <button type="button" className="btn-outline" onClick={() => resetForm()} disabled={saving}>Cancelar edição</button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Despesas cadastradas</h2>
          {loading && <span className="text-sm text-gray-500">Carregando...</span>}
        </div>

        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {displayedItems.map((it) => (
            <div key={it.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{it.descricao || '-'}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {it.tipo || '-'}
                    {' • '}
                    {it.categoria || '-'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {it.data_pagamento ? `Pago: ${it.data_pagamento}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-semibold text-gray-900">{fmtMT(it.valor)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" className="btn-outline" onClick={() => startEdit(it)}>Editar</button>
                <button type="button" className="btn-danger" onClick={() => askDelete(it.id)}>Excluir</button>
              </div>
            </div>
          ))}
          {!loading && displayedItems.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma despesa encontrada</div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="overflow-auto border rounded-lg hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedItems.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{it.tipo || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{it.categoria || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{it.descricao || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtMT(it.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className="btn-outline" onClick={() => startEdit(it)}>Editar</button>
                      <button type="button" className="btn-danger" onClick={() => askDelete(it.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && displayedItems.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma despesa encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-gray-600">
            Mostrando {Math.min(5, items.length)} de {items.length}
          </div>
          <button type="button" className="btn-outline" onClick={openHistorico}>Ver todas (Histórico)</button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir despesa"
        message="Tem certeza que deseja excluir esta despesa?"
        confirmText="Excluir"
        danger
        loading={deleteLoading}
        onCancel={() => { if (!deleteLoading) setDeleteOpen(false) }}
        onConfirm={confirmDelete}
      />

      <Modal
        open={historicoOpen}
        title="Histórico de despesas"
        onClose={() => setHistoricoOpen(false)}
        actions={(
          <button type="button" className="btn-primary" onClick={() => setHistoricoOpen(false)}>Fechar</button>
        )}
      >
        <div className="space-y-3">
          <input
            className="input"
            value={historicoBusca}
            onChange={(e) => setHistoricoBusca(e.target.value)}
            placeholder="Pesquisar..."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select className="input" value={historicoTipo} onChange={(e) => setHistoricoTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="Fixa">Fixa</option>
              <option value="Variável">Variável</option>
            </select>
            <select className="input" value={historicoCategoria} onChange={(e) => setHistoricoCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600">Data inicial</label>
              <input className="input" type="date" value={historicoDataInicial} onChange={(e) => setHistoricoDataInicial(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Data final</label>
              <input className="input" type="date" value={historicoDataFinal} onChange={(e) => setHistoricoDataFinal(e.target.value)} />
            </div>
          </div>
          {historicoLoading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {historicoFiltrado.map((h) => (
                  <div key={h.id} className="border rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500">{h.data_pagamento || h.created_at || '-'}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1 break-words">{h.descricao || '-'}</div>
                        <div className="text-xs text-gray-600 mt-2">
                          {h.tipo || '-'}
                          {' • '}
                          {h.categoria || '-'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-semibold text-gray-900">{fmtMT(h.valor)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {historicoFiltrado.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">Sem dados</div>
                )}
              </div>

              {/* Desktop: table */}
              <div className="overflow-auto border rounded-lg hidden md:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historicoFiltrado.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{h.data_pagamento || h.created_at || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{h.descricao || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{h.categoria || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{h.tipo || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{fmtMT(h.valor)}</td>
                      </tr>
                    ))}
                    {historicoFiltrado.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-3 py-8 text-center text-sm text-gray-500">Sem dados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
