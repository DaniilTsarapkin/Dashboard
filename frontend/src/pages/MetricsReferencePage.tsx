const GROUPS = [
  {
    name: 'Группа 1: Поток и Трение (Flow & Friction)',
    description: 'Оценивает «вязкость» среды разработки: вынужденные задержки и препятствия в пайплайне, которые ломают состояние потока и ухудшают Developer Experience.',
    metrics: [
      {
        id: 'M01',
        name: 'Feedback Loop Latency',
        nameRu: 'Задержка обратной связи',
        unit: 'часы',
        formula: 'Median( min(T_first_human_response) − T_request ) по всем PR',
        description: 'Медианное время от момента запроса разработчика (создание PR или переход из Draft) до первой содержательной реакции коллеги. Показатель «отзывчивости» коммуникационной среды.',
        interpretation: 'Высокое значение означает, что разработчик вынужден долго ждать ответа, что разрывает петлю обратной связи и провоцирует переключение контекста.',
      },
      {
        id: 'M02',
        name: 'Process Blockage Time',
        nameRu: 'Время процессной блокировки',
        unit: 'часы',
        formula: 'Median( Σ gaps_waiting_colleague + Σ gaps_waiting_author ) по PR',
        description: 'Чистое время «простоя» PR, когда задача лежит мёртвым грузом в ожидании действий от других людей (ревью/ответа) или от автора после полученного фидбека.',
        interpretation: 'Высокое значение говорит не о том, что разработчики медленные, а о том, что взаимодействие в процессе сломано: ожидания и очереди мешают доводить работу до конца.',
      },
      {
        id: 'M03',
        name: 'Fragmentation Rate',
        nameRu: 'Уровень фрагментации',
        unit: 'контекстов/час',
        formula: 'Median( уникальных PR/Issue на (разработчик, час) )',
        description: 'Частота, с которой среда вынуждает разработчика переключать внимание между разными контекстами (задачами/PR/обсуждениями) в течение одного часа.',
        interpretation: 'Высокая фрагментация — симптом «шумной» среды: разработчика дёргают срочными просьбами и ревью, не оставляя длинных отрезков непрерывной работы.',
      },
      {
        id: 'M04',
        name: 'Post-Interruption Recovery Cost',
        nameRu: 'Цена восстановления после прерывания',
        unit: 'часы',
        formula: 'Median( T_return_to_own_PR − T_interrupt ) по всем событиям прерывания',
        description: 'Скрытые временные потери, необходимые разработчику, чтобы вернуться в свою задачу после отвлечения на помощь/ревью/вопросы.',
        interpretation: 'Делает видимым системный налог: «5 минут ревью + X минут на возврат в свою задачу». Измеряет не эффективность человека, а цену прерываний, создаваемых процессом.',
      },
    ],
  },
  {
    name: 'Группа 2: Когнитивная Нагрузка (Cognitive Load)',
    description: 'Оценивает ментальные усилия, которые среда разработки требует от разработчика: насколько тяжело читать PR, насколько «плавают» требования, и насколько часто приходится делать пробные шаги.',
    metrics: [
      {
        id: 'M05',
        name: 'Review Complexity Index',
        nameRu: 'Индекс сложности ревью',
        unit: 'безразмерное',
        formula: 'Median( 0.5·ln(1+files) + 0.3·ln(1+churn) + 0.2·ln(1+dirs) )',
        description: 'Объём информации и число контекстов, которые ревьюер должен удерживать в голове, чтобы качественно проверить PR.',
        interpretation: 'Высокий RCI создаёт условия для поверхностного ревью, увеличивает усталость и задерживает обратную связь.',
      },
      {
        id: 'M06',
        name: 'Requirements Clarity Score',
        nameRu: 'Ясность требований',
        unit: '0–1',
        formula: 'Median( 1 / (1 + iteration_count) ) где итерация = цикл F→C→F',
        description: 'Показывает «турбулентность» согласования: сколько раз разработчик был вынужден менять код из-за уточнения требований по ходу ревью.',
        interpretation: 'Низкое значение (< 0.5) — признак того, что критерии приёмки нечёткие или меняются после начала работы. Обратная шкала: 1.0 = идеально.',
      },
      {
        id: 'M07',
        name: 'Exploration Overhead',
        nameRu: 'Накладные расходы на исследование',
        unit: '0–1',
        formula: 'Median( DeadEndChurn / (TotalChurn + 1) ) по PR',
        description: 'Доля правок, которые были сделаны «в процессе поиска решения», но не дошли до финального diff. Требует загрузки данных коммитов.',
        interpretation: 'Высокий показатель означает, что кодовая база плохо поддерживает ориентирование: разработчик вынужден «нащупывать» решение.',
      },
    ],
  },
  {
    name: 'Группа 3: Безопасность и Надёжность (Safety & Reliability)',
    description: 'Оценивает, насколько безопасно и предсказуемо разработчику вносить изменения: не придётся ли откатывать, не сломается ли CI, не нужно ли переделывать закрытую работу.',
    metrics: [
      {
        id: 'M08',
        name: 'Environment Safety Score',
        nameRu: 'Безопасность среды',
        unit: '0–1',
        formula: 'ESS = 1 − normalize(0.6·RAM + 0.4·HFP), где RAM = reverts/merged, HFP = hotfixes_72h/merged',
        description: 'Насколько безопасно вносить изменения без риска устроить «пожар»: часто ли после мержа приходится откатывать или срочно чинить.',
        interpretation: 'Значение ниже 0.5 — тревожный сигнал. Разработчики начинают избегать мержей и испытывают хронический стресс. Обратная шкала: 1.0 = безопасно.',
      },
      {
        id: 'M09',
        name: 'Rework Rate',
        nameRu: 'Уровень переделок',
        unit: '0–1',
        formula: 'reopened_items(14 дней) / closed_items по PR + Issues',
        description: 'Как часто команде приходится возвращаться к уже закрытой работе. Считаются элементы переоткрытые в течение 14 дней после закрытия.',
        interpretation: 'Высокое значение — признак системных проблем: плохие критерии приёмки, отсутствие тестового покрытия, несогласованность процесса.',
      },
      {
        id: 'M10',
        name: 'Infrastructure Wait Time',
        nameRu: 'Ожидание инфраструктуры',
        unit: 'часы',
        formula: 'Median( max(completedAt) − min(startedAt) по required checks ) per PR',
        description: 'Реальное время, которое разработчик ждёт завершения всех CI-проверок. Параллельные проверки не суммируются — считается wall-clock время.',
        interpretation: 'Высокое значение означает, что автоматика тормозит процесс. Помечается как «Н/Д» если репозиторий не использует CI.',
      },
    ],
  },
  {
    name: 'Группа 4: Культура и Коммуникация (Culture & Communication)',
    description: 'Оценивает качество коммуникационной среды: насколько легко договориться, насколько общение поддерживающее, и не превращается ли ревью в «болотную дискуссию».',
    metrics: [
      {
        id: 'M11',
        name: 'Collaboration Friction',
        nameRu: 'Трение сотрудничества',
        unit: 'безразмерное',
        formula: 'Median( Discussion / (1 + ln(1 + changedFiles)) ) по PR',
        description: 'Избыточные коммуникационные издержки: сколько обсуждений требуется для принятия изменения, с поправкой на масштаб PR.',
        interpretation: 'Высокое значение означает, что разработчикам сложно договориться: правила и ожидания неочевидны, ревью превращается в длинные согласования.',
      },
      {
        id: 'M12',
        name: 'Psychological Safety Signal',
        nameRu: 'Сигнал психологической безопасности',
        unit: '0–1',
        formula: 'total_support / (total_support + total_negative + 1) по реакциям и текстовым маркерам',
        description: 'Баланс поддерживающих и напряжённых сигналов в обсуждениях PR и Issues: реакции, благодарности vs резкие формулировки.',
        interpretation: 'Значение ниже 0.5 — преобладает напряжение. Разработчики начинают избегать вопросов и реже показывать промежуточные решения. Обратная шкала: 1.0 = позитив.',
      },
    ],
  },
  {
    name: 'Группа 5: Организационное Здоровье (Organizational Health & Waste)',
    description: 'Фиксирует накопительные процессы, которые не заметны в оперативной работе, но постепенно снижают устойчивость команды. Их игнорирование — главная причина внезапных кризисов.',
    metrics: [
      {
        id: 'M13',
        name: 'Systemic Overload Index',
        nameRu: 'Индекс системной перегрузки',
        unit: '0–1',
        formula: 'Median( events_outside_base_window / (total + 1) ) по разработчикам',
        description: 'Доля активности команды, выходящей за рамки привычного рабочего ритма. Базовый профиль строится из предыдущего периода.',
        interpretation: 'Высокое значение сигнализирует о системном давлении: переработки, сдвиг графика, нетипичная нагрузка.',
      },
      {
        id: 'M14',
        name: 'Knowledge Concentration Risk',
        nameRu: 'Риск концентрации знаний',
        unit: '0–1',
        formula: 'concentrated_modules(θ=0.6) / (total_modules + 1)',
        description: 'Доля модулей проекта, где более 60% изменений сосредоточены у одного человека. Индикатор bus factor.',
        interpretation: 'Высокое значение — риск потери знаний. Если единственный эксперт модуля уйдёт, никто не сможет поддерживать код.',
      },
      {
        id: 'M15',
        name: 'Onboarding Efficiency',
        nameRu: 'Эффективность онбординга',
        unit: 'дни',
        formula: 'Median( days from first PR to first merged PR ) по новым участникам',
        description: 'Сколько дней нужно новому участнику от первого PR до первого принятого PR. Воронка: новые → получили фидбек → получили мердж.',
        interpretation: 'Высокое значение — процесс недружелюбен к новичкам. Предупреждение при менее 5 участниках: метрика статистически неустойчива.',
      },
      {
        id: 'M16',
        name: 'Cost of Process Waste',
        nameRu: 'Стоимость процессных потерь',
        unit: 'часы',
        formula: 'infra_wait + blockage + rework_events × 1.5ч',
        description: 'Суммарные потери команды за период в человеко-часах. Складывается из трёх компонентов: ожидание CI, процессные блокировки, переделки.',
        interpretation: 'Главная бизнес-метрика. При вводе ставки ₽/час переводится в денежный эквивалент для обоснования инвестиций в улучшения.',
      },
    ],
  },
]

export default function MetricsReferencePage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-2">Справка по метрикам</h1>
      <p className="text-sm text-gray-400 mb-6">
        16 метрик диагностики трения в процессах разработки, сгруппированных по 5 аспектам Developer Experience.
      </p>

      {GROUPS.map(group => (
        <section key={group.name} className="mb-8">
          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wide mb-1">
              {group.name}
            </h2>
            <p className="text-xs text-gray-400">{group.description}</p>
          </div>

          <div className="space-y-3">
            {group.metrics.map(m => (
              <div key={m.id} className="bg-gray-900 rounded-lg p-4 border-l-4 border-gray-700">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-yellow-400 font-bold text-sm">{m.id}</span>
                  <span className="text-gray-100 font-semibold text-sm">{m.name}</span>
                  <span className="text-gray-400 text-xs">({m.nameRu})</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                    {m.unit}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-2">{m.description}</p>
                <div className="text-xs text-gray-400 mb-2">
                  <span className="text-gray-400 font-medium">Формула: </span>
                  <code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">{m.formula}</code>
                </div>
                <div className="text-xs text-gray-400">
                  <span className="text-gray-400 font-medium">Интерпретация: </span>
                  {m.interpretation}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="bg-gray-900 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">
          Пороговые значения
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
          <div>
            <p className="font-medium text-gray-300 mb-1">Обычные метрики (выше = хуже):</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#2ecc71]" /> Ниже P50 — В норме</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#f1c40f]" /> P50–P75 — Требует внимания</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#e67e22]" /> P75–P90 — Повышенное трение</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#e74c3c]" /> Выше P90 — Аномалия</div>
            </div>
          </div>
          <div>
            <p className="font-medium text-gray-300 mb-1">Обратные метрики (M06, M08, M12):</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#2ecc71]" /> ≥ 0.7 — В норме</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#f1c40f]" /> 0.5–0.7 — Требует внимания</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#e67e22]" /> 0.3–0.5 — Повышенное трение</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#e74c3c]" /> Ниже 0.3 — Аномалия</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
