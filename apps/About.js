import React from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

export default function About() {
    return html`
        <div className="tool-card about-app">
            <div style=${{ padding: '0.5rem 0', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                <p style=${{ marginBottom: '1.5rem' }}>
                    A suite of web-based Morse code practice utilities. Designed to work with the <strong>Morserino-32</strong>, 
                    but compatible with any device that emulates a USB keyboard sending 
                    <strong>Left Control</strong> (Dit) and <strong>Right Control</strong> (Dah).
                </p>
                
                <p style=${{ marginBottom: '1.5rem' }}>
                    This includes standard computer keyboards (using the Ctrl keys or the <strong>[</strong> and <strong>]</strong> keys), 
                    as well as interfaces like VBand or Vail.
                </p>

                <div style=${{ borderTop: '1px solid var(--border-color)', marginTop: '2.5rem', paddingTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <p style=${{ fontStyle: 'italic' }}>
                        Note: Primarily written for personal usage and offered "AS IS" with no warranty of any kind.
                    </p>
                </div>
            </div>
        </div>
    `;
}
