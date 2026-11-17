import { useEffect, useState } from 'react';
import { Check, Lock, MapPin } from 'lucide-react';
import {
  CAMPAIGN_STAGES,
  MYSTERY_CATEGORIES,
  isStageUnlockedForUser,
} from '../data/campaignCases.ts';
import type { CampaignStage, MysteryCategoryId } from '../types/mystery.ts';

interface CampaignMapViewProps {
  completedStageIds: string[];
  activeStageId?: string;
  onStartStage: (stage: CampaignStage) => void;
}

export function CampaignMapView({
  completedStageIds,
  activeStageId,
  onStartStage,
}: CampaignMapViewProps) {
  const activeStageObj = CAMPAIGN_STAGES.find((s) => s.stageId === activeStageId);
  const [selectedCategory, setSelectedCategory] = useState<MysteryCategoryId>(
    activeStageObj?.categoryId ?? 'murder'
  );

  const trackStages = CAMPAIGN_STAGES.filter((s) => s.categoryId === selectedCategory);
  const defaultTrackStage =
    trackStages.find((s) => s.stageId === activeStageId) ??
    trackStages.find(
      (s) => isStageUnlockedForUser(s, completedStageIds) && !completedStageIds.includes(s.stageId)
    ) ??
    trackStages[0];

  const [selectedStageId, setSelectedStageId] = useState<string>(defaultTrackStage.stageId);

  useEffect(() => {
    const belongsToCategory = trackStages.some((s) => s.stageId === selectedStageId);
    if (!belongsToCategory && defaultTrackStage) {
      setSelectedStageId(defaultTrackStage.stageId);
    }
  }, [selectedCategory, selectedStageId, trackStages, defaultTrackStage]);

  const selectedStage =
    trackStages.find((s) => s.stageId === selectedStageId) ?? trackStages[0];
  const selectedIsCompleted = completedStageIds.includes(selectedStage.stageId);
  const selectedIsUnlocked = isStageUnlockedForUser(selectedStage, completedStageIds);

  const totalCompletedCount = CAMPAIGN_STAGES.filter((s) =>
    completedStageIds.includes(s.stageId)
  ).length;

  const activeCategoryMeta =
    MYSTERY_CATEGORIES.find((c) => c.id === selectedCategory) ?? MYSTERY_CATEGORIES[0];

  return (
    <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-10 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#C9A45C]/15 pb-6">
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-[#B54842]">
            Mystery Types &amp; Staged Progression
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[#E8DEC8]">
            Investigation Map
          </h1>
          <p className="text-sm text-[#9C9281] max-w-prose">
            Choose the type of mystery you want to solve—Murder, Ancient, or Heist &amp; Cipher. Each track advances from Easy to Medium to Hard as you solve cases using Ask Raazi.
          </p>
        </div>

        <div className="text-left sm:text-right shrink-0 space-y-1">
          <p className="text-xs text-[#9C9281]">Total Solved</p>
          <p className="text-xl font-mono tabular-nums font-semibold text-[#C9A45C]">
            {totalCompletedCount} / {CAMPAIGN_STAGES.length} Cases
          </p>
        </div>
      </header>

      {/* Mystery Type Selector Tabs */}
      <section aria-label="Mystery Type Selection" className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MYSTERY_CATEGORIES.map((category) => {
          const catStages = CAMPAIGN_STAGES.filter((s) => s.categoryId === category.id);
          const catDone = catStages.filter((s) => completedStageIds.includes(s.stageId)).length;
          const isActive = category.id === selectedCategory;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`text-left p-4 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                isActive
                  ? 'bg-[#1C1915] border-[#C9A45C]'
                  : 'bg-[#141210] border-[#C9A45C]/15 hover:border-[#C9A45C]/45'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                <span className={isActive ? 'text-[#C9A45C]' : 'text-[#9C9281]'}>
                  {category.subtitle}
                </span>
                <span className="text-[#E8DEC8]">{catDone}/3</span>
              </div>
              <h2 className="text-lg font-serif font-semibold text-[#E8DEC8]">
                {category.label}
              </h2>
              <p className="text-xs text-[#9C9281] leading-relaxed">
                {category.description}
              </p>
            </button>
          );
        })}
      </section>

      {/* Interactive SVG Track Map (Easy -> Medium -> Hard) */}
      <section className="bg-[#141210] border border-[#C9A45C]/20 rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-serif font-semibold text-[#E8DEC8]">
            {activeCategoryMeta.label} Trail
          </h2>
          <span className="text-xs text-[#9C9281]">
            Easy → Medium → Hard
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 700 240"
            className="w-full min-w-[540px] h-auto"
            role="img"
            aria-label={`${activeCategoryMeta.label} three-stage map from Easy to Hard`}
          >
            {/* Subtle cartographic grid lines */}
            <line x1="20" y1="60" x2="680" y2="60" stroke="rgba(201,164,92,0.06)" />
            <line x1="20" y1="120" x2="680" y2="120" stroke="rgba(201,164,92,0.06)" />
            <line x1="20" y1="180" x2="680" y2="180" stroke="rgba(201,164,92,0.06)" />
            <line x1="230" y1="15" x2="230" y2="225" stroke="rgba(201,164,92,0.06)" />
            <line x1="470" y1="15" x2="470" y2="225" stroke="rgba(201,164,92,0.06)" />

            {/* Route segments connecting Easy -> Medium -> Hard */}
            {trackStages.slice(0, -1).map((stage, idx) => {
              const next = trackStages[idx + 1];
              const isTrailActive =
                completedStageIds.includes(stage.stageId) ||
                isStageUnlockedForUser(next, completedStageIds);
              const midX = (stage.coordinates.x + next.coordinates.x) / 2;
              const ctrlY = idx % 2 === 0 ? 55 : 185;
              return (
                <path
                  key={`${stage.stageId}-${next.stageId}`}
                  d={`M ${stage.coordinates.x} ${stage.coordinates.y} Q ${midX} ${ctrlY} ${next.coordinates.x} ${next.coordinates.y}`}
                  fill="none"
                  stroke={isTrailActive ? '#C9A45C' : 'rgba(156,146,129,0.28)'}
                  strokeWidth={isTrailActive ? 2.4 : 1.5}
                  strokeDasharray={isTrailActive ? undefined : '5 6'}
                />
              );
            })}

            {/* Stage Nodes */}
            {trackStages.map((stage) => {
              const isCompleted = completedStageIds.includes(stage.stageId);
              const isUnlocked = isStageUnlockedForUser(stage, completedStageIds);
              const isSelected = stage.stageId === selectedStage.stageId;
              const isCurrentActive = stage.stageId === activeStageId;

              const fill = isCompleted
                ? '#C9A45C'
                : isUnlocked
                  ? '#B54842'
                  : '#1C1915';
              const stroke = isSelected
                ? '#E8DEC8'
                : isUnlocked
                  ? '#C9A45C'
                  : 'rgba(156,146,129,0.4)';

              return (
                <g
                  key={stage.stageId}
                  onClick={() => setSelectedStageId(stage.stageId)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      cx={stage.coordinates.x}
                      cy={stage.coordinates.y}
                      r={30}
                      fill="none"
                      stroke="#E8DEC8"
                      strokeOpacity={0.35}
                      strokeWidth={1.2}
                    />
                  )}
                  <circle
                    cx={stage.coordinates.x}
                    cy={stage.coordinates.y}
                    r={22}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={2}
                  />
                  <text
                    x={stage.coordinates.x}
                    y={stage.coordinates.y + 4}
                    textAnchor="middle"
                    className="text-xs font-mono font-semibold"
                    fill={isCompleted ? '#0B0A09' : '#E8DEC8'}
                  >
                    {isCompleted ? '✓' : `0${stage.stageOrder}`}
                  </text>

                  <text
                    x={stage.coordinates.x}
                    y={stage.coordinates.y + 40}
                    textAnchor="middle"
                    className="text-xs font-medium"
                    fill={isUnlocked ? '#E8DEC8' : '#9C9281'}
                  >
                    {stage.locationName}
                  </text>
                  <text
                    x={stage.coordinates.x}
                    y={stage.coordinates.y + 56}
                    textAnchor="middle"
                    className="text-[11px] font-mono"
                    fill={isCurrentActive ? '#C9A45C' : '#9C9281'}
                  >
                    {stage.difficultyTier} · {isCompleted ? 'Solved' : isUnlocked ? 'Unlocked' : 'Locked'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-[#9C9281] pt-2 border-t border-[#C9A45C]/10">
          <span>Completed: Gold Seal</span>
          <span>Unlocked Frontier: Crimson Seal</span>
          <span>Locked: Solve previous difficulty using Ask Raazi to unlock</span>
        </div>
      </section>

      {/* Selected Stage Dossier Card */}
      <section className="p-6 sm:p-8 bg-[#141210] border border-[#C9A45C]/20 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span className="font-mono text-[#C9A45C]">{selectedStage.stageLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#B54842] font-medium">{selectedStage.difficultyTier}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#9C9281]">{selectedStage.genre}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#9C9281]">
              {selectedIsCompleted ? 'Solved' : selectedIsUnlocked ? 'Ready to Investigate' : 'Locked'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-[#E8DEC8]">
            {selectedStage.locationName}
          </h2>

          <p className="text-sm text-[#9C9281] leading-relaxed">
            {selectedStage.summary}
          </p>
        </div>

        <div className="shrink-0">
          {selectedIsUnlocked ? (
            <button
              type="button"
              onClick={() => onStartStage(selectedStage)}
              className="px-6 py-3 text-xs sm:text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {selectedIsCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              <span>
                {selectedStage.stageId === activeStageId
                  ? 'Return to Case'
                  : selectedIsCompleted
                    ? 'Replay Stage'
                    : `Start ${selectedStage.difficultyTier} Case`}
              </span>
            </button>
          ) : (
            <div className="px-5 py-3 text-xs font-medium bg-[#0B0A09] border border-[#9C9281]/25 text-[#9C9281] rounded-md flex items-center gap-2 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" />
              <span>
                Solve {selectedStage.stageOrder === 2 ? 'Easy' : 'Medium'} {selectedStage.categoryLabel} First
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
