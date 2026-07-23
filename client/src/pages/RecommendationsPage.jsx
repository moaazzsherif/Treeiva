import React from 'react';
import PrescriptionCard from '../components/PrescriptionCard';

export default function RecommendationsPage({ analysis }) {
  const fRec = analysis?.fertilizer_recommendation || {};
  const nRec = fRec.nitrogen || {};
  const pRec = fRec.phosphorus || {};
  const kRec = fRec.potassium || {};
  const irrRec = fRec.irrigation || {};

  const handleWhatsApp = () => {
    const crop = analysis?.crop_ar || analysis?.crop || 'قمح';
    const area = fRec.area_feddan || 5;
    const msg = `🌾 *توصية التسميد والري الذكي - MERN Terriva* 🌾%0A` +
                `• المحصول: ${crop} | المساحة: ${area} فدان%0A%0A` +
                `🧪 *الأسمدة الموصى بها:*%0A` +
                `- النيتروجين: ${nRec.fertilizer_name || 'سلفات نشادر'} -> ${nRec.total_bags_field || 0} شكارة%0A` +
                `- الفوسفور: ${pRec.fertilizer_name || 'سوبر فوسفات'} -> ${pRec.total_bags_field || 0} شكارة%0A` +
                `- البوتاسيوم: ${kRec.fertilizer_name || 'سلفات بوتاسيوم'} -> ${kRec.total_bags_field || 0} شكارة%0A%0A` +
                `💧 *الري الذكي:*%0A` +
                `- الكمية: ${irrRec.water_m3_per_feddan || 85} م³/فدان%0A` +
                `- الجدول: ${irrRec.irrigation_schedule_ar || 'كل 4 إلى 6 أيام'}`;
    window.open(`https://wa.me/201011068548?text=${msg}`, '_blank');
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="row-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#f8fafc', margin: 0 }}>
            <i className="fa-solid fa-seedling" style={{ color: 'var(--primary, #8B9B49)', marginRight: '8px' }}></i>
            التوصية السمادية والاحتياج المائي الذكي (MERN Prescription)
          </h2>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>
            توصيات مخصصة لنوع وكمية السماد ومواعيد وكميات الري ($m^3/\text{فدان}$)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="glass-btn" style={{ color: '#25D366', borderColor: 'rgba(37,211,102,0.4)' }} onClick={handleWhatsApp}>
            <i className="fa-brands fa-whatsapp"></i> مشاركة عبر واتساب
          </button>
          <button className="primary-btn" onClick={() => window.print()}>
            <i className="fa-solid fa-print"></i> طباعة تقرير PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <PrescriptionCard
          title="السماد النيتروجيني (N)"
          icon="fa-flask"
          color="#10b981"
          fertName={nRec.fertilizer_name || 'سلفات نشادر 20.6%'}
          kgFeddan={nRec.kg_per_feddan || 0}
          bagsFeddan={nRec.bags_per_feddan || 0}
          totalBags={nRec.total_bags_field || 0}
          reason={nRec.recommendation_reason || 'توزيع متوازن للتسميد'}
        />

        <PrescriptionCard
          title="السماد الفوسفاتي (P)"
          icon="fa-atom"
          color="#3b82f6"
          fertName={pRec.fertilizer_name || 'سوبر فوسفات أحادي'}
          kgFeddan={pRec.kg_per_feddan || 0}
          bagsFeddan={pRec.bags_per_feddan || 0}
          totalBags={pRec.total_bags_field || 0}
          reason={pRec.recommendation_reason || 'تحفيز نمو الجذور'}
        />

        <PrescriptionCard
          title="السماد البوتاسي (K)"
          icon="fa-bolt"
          color="#f59e0b"
          fertName={kRec.fertilizer_name || 'سلفات بوتاسيوم 50%'}
          kgFeddan={kRec.kg_per_feddan || 0}
          bagsFeddan={kRec.bags_per_feddan || 0}
          totalBags={kRec.total_bags_field || 0}
          reason={kRec.recommendation_reason || 'تحسين حجم وملاءمة الثمار'}
        />
      </div>
    </div>
  );
}
