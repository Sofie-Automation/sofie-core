import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';
import HomepageFeatures from '../components/HomepageFeatures';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle margin-vert--lg">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="docs/about-sofie">
            Learn more…
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Sofie is a web-based, open source TV automation system for studios and live shows, used in daily live TV news productions by the Norwegian public&nbsp;service broadcaster NRK since September 2018.">
      <HomepageHeader />
      <main>
        {/* <section className="margin-vert--xl">
          <div className="container">
            <div className="row">
              <p>
                <em><strong>Sofie</strong></em> is a web-based, open source TV automation system for studios and
                live shows, used in daily live TV news productions by the Norwegian
                public&nbsp;service broadcaster <Link to="docs/about-sofie">NRK</Link> since September&nbsp;2018.
              </p>
            </div>
          </div>
        </section> */}
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
