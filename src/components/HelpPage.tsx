import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { User } from '../lib/types';
import { useTranslation } from 'react-i18next';

interface HelpPageProps {
  user: User;
  onBack: () => void;
}

export default function HelpPage({ onBack }: HelpPageProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50">
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold">{t('help.versionHistory')}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-8">


          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.6</h2>
                <p className="text-sm text-gray-500">2026-05-30</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v1_6_1_title')}</strong>{t('help.v1_6_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_6_2_title')}</strong>{t('help.v1_6_2_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_6_3_title')}</strong>{t('help.v1_6_3_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_6_4_title')}</strong>{t('help.v1_6_4_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.5</h2>
                <p className="text-sm text-gray-500">2026-05-26</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v1_5_1_title')}</strong>{t('help.v1_5_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_5_2_title')}</strong>{t('help.v1_5_2_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.4</h2>
                <p className="text-sm text-gray-500">2026-05-08</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v1_4_1_title')}</strong>{t('help.v1_4_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_4_2_title')}</strong>{t('help.v1_4_2_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_4_3_title')}</strong>{t('help.v1_4_3_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_4_4_title')}</strong>{t('help.v1_4_4_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_4_5_title')}</strong>{t('help.v1_4_5_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.3</h2>
                <p className="text-sm text-gray-500">2026-02-07</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v1_3_1_title')}</strong>{t('help.v1_3_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_3_2_title')}</strong>{t('help.v1_3_2_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_3_3_title')}</strong>{t('help.v1_3_3_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-rose-100">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.2</h2>
                <p className="text-sm text-gray-500">2026-01-21</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v1_1_1_title')}</strong>{t('help.v1_1_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_1_2_title')}</strong>{t('help.v1_1_2_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v1_1_3_title')}</strong>{t('help.v1_1_3_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-purple-100">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.0</h2>
                <p className="text-sm text-gray-500">2026-01-16</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.v1_0_title')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  {t('help.v1_0_1_desc')}
                </li>
                <li>
                  {t('help.v1_0_2_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-emerald-100">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v0.6</h2>
                <p className="text-sm text-gray-500">2026-01-14</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.updateContent')}</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">{t('help.v0_6_1_title')}</strong>{t('help.v0_6_1_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v0_6_2_title')}</strong>{t('help.v0_6_2_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v0_6_3_title')}</strong>{t('help.v0_6_3_desc')}
                </li>
                <li>
                  <strong className="text-gray-900">{t('help.v0_6_4_title')}</strong>{t('help.v0_6_4_desc')}
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-100">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Play size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v0.5</h2>
                <p className="text-sm text-gray-500">2025-11-17</p>
              </div>
            </div>
            <div className="pl-13 space-y-6 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">{t('help.mainFeatures')}</p>

              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-sm mr-2">1</span>
                    {t('help.howToStart')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>{t('help.start_1')}</li>
                    <li>{t('help.start_2')}</li>
                    <li>{t('help.start_3')}</li>
                    <li>{t('help.start_4')}</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-sm mr-2">2</span>
                    {t('help.howToScore')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>{t('help.score_1')}</li>
                    <li>{t('help.score_2')}</li>
                    <li>{t('help.score_3')}</li>
                    <li>{t('help.score_4')}</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-sm mr-2">3</span>
                    {t('help.drawAndPenalty')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>{t('help.dp_1')}</li>
                    <li>{t('help.dp_2')}</li>
                    <li>{t('help.dp_3')}</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-sm mr-2">4</span>
                    {t('help.historyManagement')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>{t('help.hist_1')}</li>
                    <li>{t('help.hist_2')}</li>
                    <li>{t('help.hist_3')}</li>
                    <li>{t('help.hist_4')}</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 text-pink-600 text-sm mr-2">5</span>
                    {t('help.statsFunction')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>{t('help.stat_1')}</li>
                    <li>{t('help.stat_2')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center space-y-2 text-sm text-gray-500">
              <p>{t('help.sponsor')}</p>
              <p>{t('help.author')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
