import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type {
  CareerOpportunityReport,
  ScoredOpportunity,
} from '../src/types/report.ts';

const NAVY = '0F2942';
const SLATE_DARK = '1E293B';
const SLATE_MUTED = '475569';
const BORDER_LIGHT = 'CBD5E1';
const HEADER_FILL = 'F1F5F9';
const PRIORITY_FILL = 'EFF6FF';
const ALERT_FILL = 'FEF2F2';
const LINK_BLUE = '1D4ED8';

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_LIGHT },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_LIGHT },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_LIGHT },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_LIGHT },
};

const CELL_MARGINS = {
  top: 100,
  bottom: 100,
  left: 130,
  right: 130,
};

function sectionHeading(num: string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 340, after: 140 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
    },
    children: [
      new TextRun({
        text: `${num}. ${title}`,
        bold: true,
        size: 26,
        color: NAVY,
        font: 'Calibri',
      }),
    ],
  });
}

function subHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 90 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 22,
        color: SLATE_DARK,
        font: 'Calibri',
      }),
    ],
  });
}

function bodyParagraph(text: string, spacingAfter = 120): Paragraph {
  return new Paragraph({
    spacing: { after: spacingAfter, line: 276 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: SLATE_DARK,
        font: 'Calibri',
      }),
    ],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 260 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: SLATE_DARK,
        font: 'Calibri',
      }),
    ],
  });
}

function headerCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADER_FILL },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 18,
            color: NAVY,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function textCell(
  text: string,
  opts?: { bold?: boolean; fill?: string; widthPct?: number; color?: string }
): TableCell {
  return new TableCell({
    width: opts?.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: opts?.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            bold: opts?.bold,
            size: 18,
            color: opts?.color || SLATE_DARK,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function linkCell(
  label: string,
  url: string,
  opts?: { fill?: string; widthPct?: number }
): TableCell {
  const validLink = /^https?:\/\//i.test(url || '');
  return new TableCell({
    width: opts?.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    shading: opts?.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
    children: [
      new Paragraph({
        children: validLink
          ? [
              new ExternalHyperlink({
                link: url,
                children: [
                  new TextRun({
                    text: label || 'Open Verified Link',
                    color: LINK_BLUE,
                    underline: {},
                    size: 18,
                    font: 'Calibri',
                  }),
                ],
              }),
            ]
          : [
              new TextRun({
                text: label || 'Source Verified',
                size: 18,
                color: SLATE_MUTED,
                font: 'Calibri',
              }),
            ],
      }),
    ],
  });
}

function renderOpportunityCards(
  jobs: ScoredOpportunity[],
  isPrimary: boolean
): (Paragraph | Table)[] {
  if (jobs.length === 0) {
    return [
      bodyParagraph(
        isPrimary
          ? 'No active primary postings met the strict 30-calendar-day verified posting date and live public URL criteria during this cycle.'
          : 'No separate active adjacent postings met the strict 30-calendar-day verification filter during this cycle.'
      ),
    ];
  }

  const elements: (Paragraph | Table)[] = [];

  // Summary matrix table
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell(isPrimary ? 'Rank' : '#', 7),
            headerCell('Role & Organization', 25),
            headerCell('Location', 12),
            headerCell('Posted / Verified', 15),
            headerCell('Fit / Growth / Comp (33.3% ea.)', 17),
            headerCell('Total Score', 9),
            headerCell('Compensation & Source', 15),
          ],
        }),
        ...jobs.map((job) => {
          const fill = job.isTopPriority ? PRIORITY_FILL : undefined;
          return new TableRow({
            children: [
              textCell(
                job.isTopPriority ? `#${job.rank} ★` : `#${job.rank}`,
                { bold: true, fill }
              ),
              textCell(`${job.title} — ${job.organization} (${job.category})`, {
                bold: job.isTopPriority,
                fill,
              }),
              textCell(job.location, { fill }),
              textCell(
                `Posted: ${job.postedDate}\nVerified: ${job.verificationDate}`,
                { fill }
              ),
              textCell(
                `Fit: ${job.qualificationsFitScore} | Grw: ${job.careerGrowthScore} | Cmp: ${job.totalCompScore}`,
                { fill }
              ),
              textCell(`${job.compositeScore.toFixed(1)}`, {
                bold: true,
                fill,
                color: NAVY,
              }),
              linkCell(
                `${job.compensationTotalCad} [${job.compensationLabel}] — ${job.sourceName}`,
                job.directUrl,
                { fill }
              ),
            ],
          });
        }),
      ],
    })
  );

  // Detailed evidence breakdown per job
  for (const job of jobs) {
    const priorityTag = job.isTopPriority ? ' [TOP 3 PRIORITY]' : '';
    elements.push(
      subHeading(
        `#${job.rank}${priorityTag}: ${job.title} — ${job.organization} (${job.location})`
      )
    );
    elements.push(
      new Paragraph({
        spacing: { after: 70 },
        children: [
          new TextRun({
            text: `Practice: ${job.category}  |  Original Posting Date: ${job.postedDate} (${job.daysSincePosted}d ago)  |  Verified: ${job.verificationDate}  |  Source: `,
            size: 18,
            color: SLATE_MUTED,
            font: 'Calibri',
          }),
          new ExternalHyperlink({
            link: job.directUrl,
            children: [
              new TextRun({
                text: `${job.sourceName} (${job.directUrl})`,
                size: 18,
                color: LINK_BLUE,
                underline: {},
                font: 'Calibri',
              }),
            ],
          }),
        ],
      })
    );
    elements.push(
      bodyParagraph(
        `Equal-Weight Scoring (33.3% each) — Composite: ${job.compositeScore.toFixed(1)}/100  |  Qualifications Fit: ${job.qualificationsFitScore}/100 (${job.qualificationsFitRationale})  |  Career Growth: ${job.careerGrowthScore}/100 (${job.careerGrowthRationale})  |  Total Compensation: ${job.totalCompScore}/100 (${job.totalCompRationale})`,
        80
      )
    );
    elements.push(
      bodyParagraph(
        `Compensation (${job.compensationLabel}): Base: ${job.compensationBaseCad} · Bonus: ${job.compensationBonusCad} · Total: ${job.compensationTotalCad}`,
        80
      )
    );
    elements.push(
      bodyParagraph(
        `Role Evidence & Strategic Fit: ${job.roleSummary} ${job.strategicFitNotes}`,
        140
      )
    );
  }

  return elements;
}

export async function buildCareerReportDocxBuffer(
  report: CareerOpportunityReport
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title Block
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'WEEKLY EVIDENCE-BASED FINANCE CAREER OPPORTUNITY REPORT',
          bold: true,
          size: 30,
          color: NAVY,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `Calgary, AB (Primary) & Saskatoon, SK (Secondary)  ·  Report Date: ${report.reportDate}  ·  Active 30-Day Window: ${report.windowStartDate} to ${report.reportDate}  ·  Cycle: ${report.weeklyChanges.modeLabel}`,
          size: 19,
          color: SLATE_MUTED,
          font: 'Calibri',
        }),
      ],
    })
  );

  // Ethics Refusal Banner if triggered (or clean compliance confirmation)
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            textCell(
              `ETHICS & CREDENTIAL COMPLIANCE (${report.ethicsAudit.statusLabel}): ${report.ethicsAudit.explanation}`,
              {
                bold: report.ethicsAudit.triggered,
                fill: report.ethicsAudit.triggered ? ALERT_FILL : HEADER_FILL,
                color: report.ethicsAudit.triggered ? '991B1B' : NAVY,
              }
            ),
          ],
        }),
      ],
    })
  );

  // Fixed Candidate Profile Table
  children.push(subHeading('Candidate Mandate & Verification Parameters'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell('Education & Experience', 34),
            headerCell('Active Candidate Designations', 34),
            headerCell('Target Compensation & Markets', 32),
          ],
        }),
        new TableRow({
          children: [
            textCell(
              `${report.candidateProfile.education}; ${report.candidateProfile.experience}`
            ),
            textCell(
              `${report.candidateProfile.mbaStatus}; ${report.candidateProfile.cfaStatus}`
            ),
            textCell(
              `${report.candidateProfile.compensationTargetCad}\n${report.candidateProfile.geographicPriority}`
            ),
          ],
        }),
      ],
    })
  );

  // 1. Executive Summary & Top 3 Priorities
  children.push(sectionHeading('01', 'Executive Summary & Top Three Priorities'));
  for (const para of report.executiveSummary) {
    children.push(bodyParagraph(para));
  }
  if (report.verificationMethodologyNote) {
    children.push(
      bodyParagraph(`Verification Scope: ${report.verificationMethodologyNote}`)
    );
  }

  if (report.topThreePriorities.length > 0) {
    children.push(subHeading('Highlighted Top Three Weekly Priorities'));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Priority', 10),
              headerCell('Opportunity & Location', 28),
              headerCell('Score', 10),
              headerCell('Rationale & Compensation', 28),
              headerCell('Immediate Next Step & Link', 24),
            ],
          }),
          ...report.topThreePriorities.map((p) =>
            new TableRow({
              children: [
                textCell(`Priority #${p.priorityRank}`, {
                  bold: true,
                  fill: PRIORITY_FILL,
                  color: NAVY,
                }),
                textCell(`${p.headline}\n${p.location} · ${p.category}`, {
                  bold: true,
                  fill: PRIORITY_FILL,
                }),
                textCell(`${p.compositeScore.toFixed(1)}/100`, {
                  bold: true,
                  fill: PRIORITY_FILL,
                }),
                textCell(`${p.whyTopPriority}\nComp: ${p.compensationSummary}`, {
                  fill: PRIORITY_FILL,
                }),
                linkCell(
                  `${p.immediateNextStep} (Open Source)`,
                  p.directUrl,
                  { fill: PRIORITY_FILL }
                ),
              ],
            })
          ),
        ],
      })
    );
  }

  // 2. Ranked Jobs (Up to 10)
  children.push(
    sectionHeading(
      '02',
      'Ranked Target Opportunities (Active, Posted Within 30 Calendar Days)'
    )
  );
  children.push(...renderOpportunityCards(report.rankedJobs, true));

  // 3. Adjacent Roles (Separated)
  children.push(
    sectionHeading('03', 'Adjacent Finance Opportunities (Separated)')
  );
  children.push(...renderOpportunityCards(report.adjacentRoles, false));

  // 4. Networking Contacts (Up to 10)
  children.push(
    sectionHeading('04', 'Verified Networking Contacts (Calgary & Saskatoon)')
  );
  children.push(
    bodyParagraph(
      'All contacts below were verified through public corporate directories, CFA Society leadership pages, or public professional profiles. No private emails or phone numbers are invented or included.'
    )
  );
  if (report.networkingContacts.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('#', 5),
              headerCell('Name & Title', 24),
              headerCell('Organization & City', 20),
              headerCell('Networking Rationale & Angle', 33),
              headerCell('Verified Public Profile', 18),
            ],
          }),
          ...report.networkingContacts.map((c) =>
            new TableRow({
              children: [
                textCell(`${c.index}`, { bold: true }),
                textCell(`${c.fullName}\n${c.currentTitle}`, { bold: true }),
                textCell(`${c.organization}\n${c.location} (${c.practiceArea})`),
                textCell(
                  `${c.networkingRationale}\nTopic: ${c.suggestedTopic}`
                ),
                linkCell(
                  `${c.publicSourceName} (Verified ${c.verificationDate})`,
                  c.publicProfileUrl
                ),
              ],
            })
          ),
        ],
      })
    );
  } else {
    children.push(bodyParagraph('No verified public networking profiles were returned in this run.'));
  }

  // 5. Compensation Insights
  children.push(
    sectionHeading('05', 'Sourced CAD Compensation Insights (Calgary & Saskatoon)')
  );
  children.push(bodyParagraph(report.compensationInsights.overview));
  if (report.compensationInsights.benchmarks.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Track & Level', 22),
              headerCell('Market', 12),
              headerCell('CAD Base', 15),
              headerCell('Bonus', 12),
              headerCell('CAD Total Comp', 16),
              headerCell('Label & Source', 23),
            ],
          }),
          ...report.compensationInsights.benchmarks.map((b) =>
            new TableRow({
              children: [
                textCell(`${b.roleTrack} — ${b.seniorityLevel}`, { bold: true }),
                textCell(b.market),
                textCell(b.baseRangeCad),
                textCell(b.bonusRangeCad),
                textCell(b.totalCompRangeCad, { bold: true }),
                linkCell(
                  `${b.compensationLabel} · ${b.sourceName} (Verified ${b.verificationDate})`,
                  b.sourceUrl
                ),
              ],
            })
          ),
        ],
      })
    );
  }

  // 6. 5-10 Hour Weekly Action Plan
  children.push(
    sectionHeading(
      '06',
      `Weekly 5–10-Hour Action Plan (Allocated: ${report.weeklyActionPlan.totalHours.toFixed(1)} Hours)`
    )
  );
  if (report.weeklyActionPlan.steps.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Step', 7),
              headerCell('Priority', 14),
              headerCell('Activity & Target', 30),
              headerCell('Hours', 10),
              headerCell('Window', 12),
              headerCell('Concrete Deliverable', 27),
            ],
          }),
          ...report.weeklyActionPlan.steps.map((s) =>
            new TableRow({
              children: [
                textCell(`${s.stepNumber}`, { bold: true }),
                textCell(s.priorityLevel, { bold: true }),
                textCell(`${s.activityTitle}\nTarget: ${s.targetReference}`),
                textCell(`${s.hoursAllocated.toFixed(1)}h`, { bold: true }),
                textCell(s.recommendedWindow),
                textCell(s.deliverable),
              ],
            })
          ),
        ],
      })
    );
  }

  // 7. Personalized Sourced Outreach Messages
  children.push(sectionHeading('07', 'Personalized, Sourced Outreach Messages'));
  children.push(
    bodyParagraph(
      'Credentials are stated strictly as "MBA candidate (expected April 2027)" and "CFA Level II candidate (expected May 2027)" in compliance with ethical standards.'
    )
  );
  for (const draft of report.outreachMessages) {
    children.push(
      subHeading(`${draft.recipientLabel} — ${draft.channel}`)
    );
    children.push(
      bodyParagraph(
        `Subject / Hook: ${draft.subjectLine}  |  Sourced Context: ${draft.sourcedHook}`,
        70
      )
    );
    children.push(bodyParagraph(draft.messageBody, 160));
  }

  // 8. Weekly Changes & Baseline Continuity
  children.push(
    sectionHeading('08', `Weekly Changes (${report.weeklyChanges.modeLabel})`)
  );
  children.push(bodyParagraph(report.weeklyChanges.summary));
  for (const item of report.weeklyChanges.newOpportunities) {
    children.push(bulletItem(`New / Active: ${item}`));
  }
  for (const item of report.weeklyChanges.closedOrRemovedOpportunities) {
    children.push(bulletItem(`Closed / Removed: ${item}`));
  }
  for (const item of report.weeklyChanges.scoreOrPriorityChanges) {
    children.push(bulletItem(`Priority / Score: ${item}`));
  }
  for (const item of report.weeklyChanges.trackerUpdates) {
    children.push(bulletItem(`Tracker Note: ${item}`));
  }

  // 9. Opportunity & Outreach Tracker
  children.push(sectionHeading('09', 'Weekly Opportunity & Networking Tracker'));
  if (report.tracker.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Type & Priority', 15),
              headerCell('Organization & Role/Contact', 25),
              headerCell('City & Date', 15),
              headerCell('Score / Comp', 14),
              headerCell('Status & Next Action', 20),
              headerCell('Follow-Up / Link', 11),
            ],
          }),
          ...report.tracker.map((row) =>
            new TableRow({
              children: [
                textCell(`${row.entryType}\n${row.priorityFlag}`, {
                  bold: row.priorityFlag.includes('Priority'),
                  fill: row.priorityFlag.includes('Priority')
                    ? PRIORITY_FILL
                    : undefined,
                }),
                textCell(`${row.organization}\n${row.roleOrContactName}`),
                textCell(`${row.location}\n${row.postedOrVerifiedDate}`),
                textCell(`${row.scoreDisplay}\n${row.compensationLabel}`),
                textCell(`${row.currentStatus}\nNext: ${row.nextAction}`),
                linkCell(`By ${row.followUpDate}`, row.directUrl),
              ],
            })
          ),
        ],
      })
    );
  }

  const doc = new Document({
    creator: 'Prairie Finance Career Brief',
    title: `Career Opportunity Report — ${report.reportDate}`,
    description:
      'Weekly verified finance career opportunity report for Calgary and Saskatoon.',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 900,
              right: 900,
              bottom: 900,
              left: 900,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Career Opportunity Report (${report.reportDate})  ·  Calgary & Saskatoon Finance Mandate`,
                    size: 16,
                    color: SLATE_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'BComm Finance · 9 Yrs Exp · MBA Candidate (Expected Apr 2027) · CFA Level II Candidate (Expected May 2027)  |  Page ',
                    size: 16,
                    color: SLATE_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: SLATE_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: SLATE_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: SLATE_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const packed = await Packer.toBuffer(doc);
  return Buffer.from(packed);
}
