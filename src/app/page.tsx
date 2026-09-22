import Calculator from '@/components/Calculator';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero container">
          <h1>Know exactly what you&rsquo;ll pay before you transfer</h1>
          <p>
            Calculate Shetabi, Paya and Satna transfer fees instantly. Always in
            sync with the latest official fee rules.
          </p>
          <div className="hero-badges">
            <span className="badge">✓ Shetabi</span>
            <span className="badge">✓ Paya</span>
            <span className="badge">✓ Satna</span>
            <span className="badge">✓ Rial & Toman</span>
            <span className="badge">✓ English & فارسی</span>
          </div>
        </section>

        <section className="container" id="calculator">
          <Calculator />
        </section>

        <section className="features container">
          <h2>Why wdpm?</h2>
          <div className="features-grid">
            <div className="feature">
              <div className="icon" aria-hidden>
                ⚡
              </div>
              <h3>Always current</h3>
              <p>
                Fee rules sync from the server, so calculations match the
                latest official tariffs.
              </p>
            </div>
            <div className="feature">
              <div className="icon" aria-hidden>
                🧮
              </div>
              <h3>Both directions</h3>
              <p>
                Add the fee to a base amount, or start from the total and find
                the base.
              </p>
            </div>
            <div className="feature">
              <div className="icon" aria-hidden>
                🌐
              </div>
              <h3>Rial & Toman</h3>
              <p>Every result is shown in both Rial and Toman.</p>
            </div>
            <div className="feature">
              <div className="icon" aria-hidden>
                🔒
              </div>
              <h3>Private</h3>
              <p>No sign-up, no tracking. Calculations run in your browser.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
