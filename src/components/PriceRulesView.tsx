"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import RuleTypesHelp from './RuleTypesHelp'

type RuleType = 'competition' | 'weekend' | 'high_season' | 'low_season' | 'holiday'
type AdjustmentType = 'percent' | 'fixed'

type PriceRule = {
  id: string
  created_by: string
  name: string
  rule_type: RuleType
  start_date: string | null
  end_date: string | null
  holiday_date: string | null
  adjustment: number
  adjustment_type: AdjustmentType
  active: boolean
  created_at?: string | null
  updated_at?: string | null
}

type EditableRule = Omit<PriceRule, 'id' | 'created_by'> & { id?: string }

function formatDates(rule: PriceRule): string {
  if (rule.rule_type === 'high_season' || rule.rule_type === 'low_season') {
    const s = rule.start_date || '-'
    const e = rule.end_date || '-'
    return `${s} → ${e}`
  }
  if (rule.rule_type === 'holiday') {
    return rule.holiday_date || '-'
  }
  return '—'
}

function formatAdjustment(adj: number, type: AdjustmentType): string {
  return type === 'percent' ? `${adj}%` : `$${adj}`
}

export default function PriceRulesView() {
  const [rules, setRules] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<EditableRule | null>(null)
  const [saving, setSaving] = useState<boolean>(false)

  const loadRules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('User not authenticated')
      const { data, error: qErr } = await supabase
        .from('price_rules')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
      if (qErr) throw qErr
      setRules((data as PriceRule[]) || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load rules')
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const openCreate = () => {
    setEditing({
      name: '',
      rule_type: 'competition',
      start_date: null,
      end_date: null,
      holiday_date: null,
      adjustment: 0,
      adjustment_type: 'percent',
      active: true,
    })
    setModalOpen(true)
  }

  const openEdit = (rule: PriceRule) => {
    setEditing({ ...rule })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const saveRule = async () => {
    if (!editing) return
    try {
      setSaving(true)
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('User not authenticated')

      const payload = {
        created_by: userId,
        name: editing.name,
        rule_type: editing.rule_type,
        start_date: editing.rule_type === 'high_season' || editing.rule_type === 'low_season' ? editing.start_date : null,
        end_date: editing.rule_type === 'high_season' || editing.rule_type === 'low_season' ? editing.end_date : null,
        holiday_date: editing.rule_type === 'holiday' ? editing.holiday_date : null,
        adjustment: editing.adjustment,
        adjustment_type: editing.adjustment_type,
        active: editing.active,
        updated_at: new Date().toISOString(),
      }

      if (editing.id) {
        const { error: upErr } = await supabase
          .from('price_rules')
          .update(payload)
          .eq('id', editing.id)
          .eq('created_by', userId)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase
          .from('price_rules')
          .insert(payload as any)
        if (insErr) throw insErr
      }
      await loadRules()
      closeModal()
    } catch (e: any) {
      setError(e?.message || 'Error saving rule')
    } finally {
      setSaving(false)
    }
  }

  const deleteRule = async (rule: PriceRule) => {
    if (!confirm('Delete this rule?')) return
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('User not authenticated')
      const { error: delErr } = await supabase
        .from('price_rules')
        .delete()
        .eq('id', rule.id)
        .eq('created_by', userId)
      if (delErr) throw delErr
      await loadRules()
    } catch (e: any) {
      setError(e?.message || 'Error deleting rule')
    }
  }

  const toggleActive = async (rule: PriceRule) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('User not authenticated')
      const { error: upErr } = await supabase
        .from('price_rules')
        .update({ active: !rule.active, updated_at: new Date().toISOString() })
        .eq('id', rule.id)
        .eq('created_by', userId)
      if (upErr) throw upErr
      await loadRules()
    } catch (e: any) {
      setError(e?.message || 'Error updating status')
    }
  }

  const rulesUi = useMemo(() => rules, [rules])

  return (
    <div className="space-y-6">
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Price Rules</h2>
          <p className="text-gray-600 text-sm">Create rules to automatically adjust your prices</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          New rule
        </button>
      </div>

      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4">
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : rulesUi.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-gray-600 text-sm">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Dates</th>
                  <th className="py-2 px-3">Adjustment</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rulesUi.map((r) => (
                  <tr key={r.id} className="border-t border-glass-200">
                    <td className="py-2 px-3 text-gray-900 font-medium">{r.name}</td>
                    <td className="py-2 px-3 text-gray-700">{r.rule_type}</td>
                    <td className="py-2 px-3 text-gray-700">{formatDates(r)}</td>
                    <td className="py-2 px-3 text-gray-700">{formatAdjustment(r.adjustment, r.adjustment_type)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right space-x-2">
                      <button onClick={() => openEdit(r)} className="px-3 py-1 rounded bg-white/70 hover:bg-white border">Edit</button>
                      <button onClick={() => toggleActive(r)} className="px-3 py-1 rounded bg-white/70 hover:bg-white border">
                        {r.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteRule(r)} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-600">No rules created yet.</div>
        )}
        {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
      </div>

      {modalOpen && editing && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px]" onClick={closeModal} />
          <div className="relative z-[12010] w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editing.id ? 'Edit rule' : 'New rule'}</h3>
            <div className="relative">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                    Name
                    <InfoTooltip text="A short, descriptive name for this rule." />
                  </label>
                  <input
                    className="w-full rounded border px-3 py-2"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      Type
                      <InfoTooltip text="Select the kind of rule. It determines which date fields are required." />
                    </label>
                    <select
                      className="w-full rounded border px-3 py-2"
                      value={editing.rule_type}
                      onChange={(e) => {
                        const nt = e.target.value as RuleType
                        setEditing((prev) => ({
                          ...(prev as EditableRule),
                          rule_type: nt,
                          // Reset conditional fields when switching types
                          start_date: nt === 'high_season' || nt === 'low_season' ? prev?.start_date ?? null : null,
                          end_date: nt === 'high_season' || nt === 'low_season' ? prev?.end_date ?? null : null,
                          holiday_date: nt === 'holiday' ? prev?.holiday_date ?? null : null,
                        }))
                      }}
                    >
                      <option value="competition">competition</option>
                      <option value="weekend">weekend</option>
                      <option value="high_season">high_season</option>
                      <option value="low_season">low_season</option>
                      <option value="holiday">holiday</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      Adjustment type
                      <InfoTooltip text="Percent increases/decreases by a %. Fixed adds/subtracts a fixed amount." />
                    </label>
                    <select
                      className="w-full rounded border px-3 py-2"
                      value={editing.adjustment_type}
                      onChange={(e) => setEditing({ ...editing, adjustment_type: e.target.value as AdjustmentType })}
                    >
                      <option value="percent">percent</option>
                      <option value="fixed">fixed</option>
                    </select>
                  </div>
                </div>

                {(editing.rule_type === 'high_season' || editing.rule_type === 'low_season') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                        Start date
                        <InfoTooltip text="First day the rule applies." />
                      </label>
                      <input
                        type="date"
                        className="w-full rounded border px-3 py-2"
                        value={editing.start_date ?? ''}
                        onChange={(e) => setEditing({ ...editing, start_date: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                        End date
                        <InfoTooltip text="Last day the rule applies." />
                      </label>
                      <input
                        type="date"
                        className="w-full rounded border px-3 py-2"
                        value={editing.end_date ?? ''}
                        onChange={(e) => setEditing({ ...editing, end_date: e.target.value || null })}
                      />
                    </div>
                  </div>
                )}

                {editing.rule_type === 'holiday' && (
                  <div>
                    <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      Holiday date
                      <InfoTooltip text="Specific holiday date when the rule applies." />
                    </label>
                    <input
                      type="date"
                      className="w-full rounded border px-3 py-2"
                      value={editing.holiday_date ?? ''}
                      onChange={(e) => setEditing({ ...editing, holiday_date: e.target.value || null })}
                    />
                  </div>
                )}

                {/* competition / weekend do not require date fields */}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      Adjustment
                      <InfoTooltip text="If type is percent, enter the % (e.g., 10 or -5). If fixed, enter the absolute amount (e.g., 20)." />
                    </label>
                    <input
                      type="number"
                      className="w-full rounded border px-3 py-2"
                      value={editing.adjustment}
                      onChange={(e) => setEditing({ ...editing, adjustment: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                      Active
                      <InfoTooltip text="Turn on to apply the rule to pricing." />
                    </label>
                    <div className="flex items-center h-[42px]">
                      <input
                        type="checkbox"
                        className="accent-red-600 w-5 h-5"
                        checked={editing.active}
                        onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={closeModal} className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-50">Cancel</button>
                  <button
                    disabled={saving}
                    onClick={saveRule}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <RuleTypesHelp />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] cursor-help"
        aria-label={text}
        title={text}
      >
        ?
      </span>
      <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-xs bg-gray-900 text-white px-2 py-1 rounded shadow z-[10000]">
        {text}
      </span>
    </span>
  )
}


