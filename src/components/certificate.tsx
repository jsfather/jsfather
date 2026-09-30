import { UniversityName } from './brand';
import { GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { grade } from '@/lib/learning';
export function Certificate({
  certificate,
}: {
  certificate: {
    id: string;
    recipientName: string;
    courseTitle: string;
    percentage: number;
    issuedAt: Date;
  };
}) {
  return (
    <article className="certificate">
      <div className="brand">
        <div className="brand-icon">
          <GraduationCap size={26} />
        </div>
        <span>
          <UniversityName />
          <span className="brand-dot">.</span>
          <small>PERSONAL UNIVERSITY</small>
        </span>
      </div>
      <div className="certificate-kicker">Recognizing a commitment to learning</div>
      <h1>Certificate of Achievement</h1>
      <p>This certifies that</p>
      <h2>{certificate.recipientName}</h2>
      <p>has successfully passed the assessment for</p>
      <h3>{certificate.courseTitle}</h3>
      <div className="certificate-score">
        <div>
          <strong>{certificate.percentage}%</strong>
          <span>Final score</span>
        </div>
        <div>
          <strong>{grade(certificate.percentage)}</strong>
          <span>Grade</span>
        </div>
      </div>
      <GraduationCap size={42} style={{ margin: '12px auto', color: '#214f3d' }} />
      <div className="certificate-bottom">
        <div>
          ISSUED
          <br />
          <strong>{format(certificate.issuedAt, 'MMMM d, yyyy')}</strong>
        </div>
        <div>
          CERTIFICATE ID
          <br />
          <strong>
            JSF-{certificate.issuedAt.getFullYear()}-{certificate.id.toUpperCase()}
          </strong>
        </div>
      </div>
      <p className="certificate-disclaimer">
        A personal achievement certificate issued by jsfather Personal University. This is not an
        official academic qualification or accredited educational certificate.
      </p>
    </article>
  );
}
