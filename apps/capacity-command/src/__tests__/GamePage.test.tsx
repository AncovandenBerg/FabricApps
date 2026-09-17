// End-to-end flow through the campaign UI: lock states on the week list,
// a full week played from map to report, the day counter and CU/SLA bars
// scaled to that week's own budget, and the report leading into the week it
// just unlocked. The scenario fixture is deliberately small and covers two
// weeks so the unlock gate has something real to work against.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WEEKS } from '@/game/campaign';
import type { GameTelemetry } from '@/game/telemetry';
import type { GameScenario } from '@/game/types';
import { GamePage } from '@/pages/GamePage';

const scenarios: GameScenario[] = [
  {
    code: 'S01',
    week: 1,
    day: 1,
    domain: 'implement-manage',
    objective: 'security',
    title: 'The contractor request',
    incident: 'A contractor needs access.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Share the gold lakehouse item only',
        cuCost: 0,
        slaDelta: 5,
        correct: true,
        feedback: 'Right: item-level sharing.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Add them as Member',
        cuCost: 0,
        slaDelta: -20,
        correct: false,
        feedback: 'Over-permissioned.',
        followUpCode: 'S01F',
      },
    ],
  },
  {
    code: 'S01F',
    week: 1,
    day: 1,
    domain: 'implement-manage',
    objective: 'security',
    title: 'The deleted dataflow',
    incident: 'The contractor deleted a dataflow.',
    isFollowUp: true,
    options: [
      {
        optionKey: 'A',
        optionText: 'Restore from Git',
        cuCost: 5,
        slaDelta: 0,
        correct: true,
        feedback: 'Git restore.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Rebuild manually',
        cuCost: 10,
        slaDelta: -10,
        correct: false,
        feedback: 'Wasteful.',
        followUpCode: null,
      },
    ],
  },
  {
    code: 'S02',
    week: 1,
    day: 2,
    domain: 'ingest-transform',
    objective: 'pipelines',
    title: 'The hardcoded connection',
    incident: 'Prod reads from test.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Deployment rules',
        cuCost: 0,
        slaDelta: 5,
        correct: true,
        feedback: 'Correct pattern.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Edit prod manually',
        cuCost: 0,
        slaDelta: -10,
        correct: false,
        feedback: 'Error-prone.',
        followUpCode: null,
      },
    ],
  },
  {
    code: 'W2S01',
    week: 2,
    day: 1,
    domain: 'monitor-optimize',
    objective: 'capacity',
    title: 'The starter pool ceiling',
    incident: 'The nightly notebook runs out of memory.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Size a custom Spark pool',
        cuCost: 10,
        slaDelta: 10,
        correct: true,
        feedback: 'Right pool for the workload.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Buy a bigger SKU',
        cuCost: 25,
        slaDelta: 0,
        correct: false,
        feedback: 'Expensive.',
        followUpCode: null,
      },
    ],
  },
  {
    code: 'W3S01',
    week: 3,
    day: 1,
    domain: 'monitor-optimize',
    objective: 'governance',
    title: 'The second platform',
    incident: 'The Belgian carrier arrives with its own workspaces.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Inventory both estates before touching either',
        cuCost: 10,
        slaDelta: 10,
        correct: true,
        feedback: 'Know what you have before you merge it.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Lift the whole estate onto your capacity tonight',
        // More than week 3's whole budget, so this is the breach lever
        cuCost: WEEKS[2].startingCu + 10,
        slaDelta: -20,
        correct: false,
        feedback: 'There was never capacity for that.',
        followUpCode: null,
      },
    ],
  },
];

const week1 = WEEKS[0];
const week2 = WEEKS[1];
const week3 = WEEKS[2];

// A week where one option costs more than the whole budget, so a single bad
// call ends the run. The second incident is never reached, which is what the
// breach report counts.
const breachScenarios: GameScenario[] = [
  {
    code: 'B01',
    week: 1,
    day: 1,
    domain: 'monitor-optimize',
    objective: 'capacity',
    title: 'The runaway notebook',
    incident: 'A notebook is eating the capacity.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Cancel the run and cap the pool',
        cuCost: 5,
        slaDelta: 5,
        correct: true,
        feedback: 'Cheap, and it holds.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Buy your way out of it',
        cuCost: week1.startingCu + 10,
        slaDelta: 0,
        correct: false,
        feedback: 'There was never budget for that.',
        followUpCode: null,
      },
    ],
  },
  {
    code: 'B02',
    week: 1,
    day: 2,
    domain: 'ingest-transform',
    objective: 'pipelines',
    title: 'The overnight load',
    incident: 'The overnight load is queued.',
    isFollowUp: false,
    options: [
      {
        optionKey: 'A',
        optionText: 'Stagger the load',
        cuCost: 5,
        slaDelta: 5,
        correct: true,
        feedback: 'Fine.',
        followUpCode: null,
      },
      {
        optionKey: 'B',
        optionText: 'Run it all at once',
        cuCost: 5,
        slaDelta: -5,
        correct: false,
        feedback: 'Contention.',
        followUpCode: null,
      },
    ],
  },
];

function makeTelemetry(): GameTelemetry {
  return {
    startSession: vi.fn().mockResolvedValue('session-1'),
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    syncSession: vi.fn().mockResolvedValue(undefined),
    completeSession: vi.fn().mockResolvedValue(undefined),
  };
}

function renderGame(telemetry: GameTelemetry, search = '') {
  return render(
    <GamePage loader={async () => scenarios} telemetry={telemetry} search={search} />
  );
}

function renderWith(list: GameScenario[], telemetry: GameTelemetry) {
  return render(
    <GamePage loader={async () => list} telemetry={telemetry} search="" />
  );
}

/** Play the fixture's week 1 perfectly, ending on the report screen. */
async function playWeekOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('map-node-open'));
  await user.click(screen.getByText('Share the gold lakehouse item only'));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByTestId('map-node-open'));
  await user.click(screen.getByText('Deployment rules'));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('GamePage', () => {
  it('shows the home briefing and only creates a session on start', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    expect(screen.getByText(`Start week ${week1.number}`)).toBeInTheDocument();
    expect(screen.getByText(/Good morning/)).toBeInTheDocument();
    // The card advertises this week's own budget, from campaign.json
    expect(
      screen.getByText(
        `${week1.days} days on call · 2 incidents · ${week1.startingCu} CU`
      )
    ).toBeInTheDocument();
    // Opening the app writes nothing
    expect(telemetry.startSession).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('start-week'));
    expect(screen.getByTestId('map-node-open')).toBeInTheDocument();
    await waitFor(() => {
      expect(telemetry.startSession).toHaveBeenCalledTimes(1);
    });
    expect(telemetry.startSession).toHaveBeenCalledWith(
      expect.stringContaining('guest-'),
      {
        weekNumber: week1.number,
        startingCu: week1.startingCu,
        startingSla: week1.startingSla,
        startingDay: 1,
      }
    );
  });

  it('lists every configured week and locks the ones not yet earned', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('week-list')).toBeInTheDocument();
    });
    // Driven by campaign.json, so the list length is not hardcoded here
    for (const week of WEEKS) {
      expect(screen.getByTestId(`week-${week.number}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId(`week-${week1.number}`)).toBeEnabled();
    expect(screen.getByTestId(`week-${week2.number}`)).toBeDisabled();
    expect(
      screen.getByText(`Finish week ${week1.number} to unlock`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`0/${WEEKS.length} weeks cleared`)
    ).toBeInTheDocument();

    // A locked week cannot start a session
    await user.click(screen.getByTestId(`week-${week2.number}`));
    expect(telemetry.startSession).not.toHaveBeenCalled();
  });

  // The Practiworks track page links each week directly. The unit tests in
  // deepLink.test.ts cover the decision; these two prove it is actually wired
  // to the screen, in the two cases that matter.
  it('follows a ?week= link straight into that week, skipping the home screen', async () => {
    const telemetry = makeTelemetry();
    renderGame(telemetry, `?week=${week1.number}`);

    await waitFor(() => {
      expect(screen.getByTestId('map-node-open')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('start-week')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(telemetry.startSession).toHaveBeenCalledTimes(1);
    });
    expect(telemetry.startSession).toHaveBeenCalledWith(
      expect.stringContaining('guest-'),
      {
        weekNumber: week1.number,
        startingCu: week1.startingCu,
        startingSla: week1.startingSla,
        startingDay: 1,
      }
    );
  });

  it('refuses a link to a locked week and lands on the week list instead', async () => {
    const telemetry = makeTelemetry();
    renderGame(telemetry, `?week=${week2.number}`);

    await waitFor(() => {
      expect(screen.getByTestId('week-list')).toBeInTheDocument();
    });
    // Not started, and the lock is still shown as a lock
    expect(telemetry.startSession).not.toHaveBeenCalled();
    expect(screen.getByTestId(`week-${week2.number}`)).toBeDisabled();
    expect(screen.getByTestId('start-week')).toBeInTheDocument();
  });

  it('plays a full week: map, choice, feedback, follow-up chaining, day advance, report', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));

    // Open the day 1 incident from the map
    await user.click(screen.getByTestId('map-node-open'));
    expect(screen.getByText('The contractor request')).toBeInTheDocument();
    // Day counter scaled to this week's own length
    expect(screen.getByTestId('status-day')).toHaveTextContent(
      `Day 1/${week1.days}`
    );
    expect(screen.getByTestId('status-week')).toHaveTextContent(
      `W${week1.number}`
    );

    // Wrong choice with a follow-up
    await user.click(screen.getByText('Add them as Member'));
    expect(screen.getByText('Over-permissioned.')).toBeInTheDocument();
    expect(screen.getByTestId('status-sla')).toHaveTextContent(
      `SLA ${week1.startingSla - 20}`
    );
    expect(screen.getByText(/an incident is coming in/i)).toBeInTheDocument();

    // Continue returns to the map; the follow-up is the open node
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      screen.getByRole('button', { name: /Open incident: The deleted dataflow/ })
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('map-node-open'));
    expect(screen.getByText('follow-up')).toBeInTheDocument();

    await user.click(screen.getByText('Restore from Git'));
    expect(screen.getByTestId('status-cu')).toHaveTextContent(
      `CU ${week1.startingCu - 5}`
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Day advances with the queue
    await user.click(screen.getByTestId('map-node-open'));
    expect(screen.getByText('The hardcoded connection')).toBeInTheDocument();
    expect(screen.getByTestId('status-day')).toHaveTextContent(
      `Day 2/${week1.days}`
    );

    await user.click(screen.getByText('Deployment rules'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // End-of-week report, titled by week, with the next week unlocked
    expect(screen.getByText('Week survived.')).toBeInTheDocument();
    expect(
      screen.getByText(`Week ${week1.number} report`)
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(week1.title))).toBeInTheDocument();
    expect(screen.getByTestId('final-cu')).toHaveTextContent(
      String(week1.startingCu - 5)
    );
    expect(screen.getByText(/2 of 3 decisions correct/)).toBeInTheDocument();
    expect(screen.getByTestId('report-unlocked')).toHaveTextContent(
      `Week ${week2.number} unlocked: ${week2.title}`
    );
    expect(screen.getByTestId('report-next')).toHaveTextContent(
      `Start week ${week2.number}`
    );

    // Review list shows the week's decisions
    await user.click(screen.getByRole('button', { name: 'Review decisions' }));
    expect(screen.getByText('Picked B · 0 CU · -20 SLA')).toBeInTheDocument();

    // Telemetry contract, including the week on every attempt
    expect(telemetry.startSession).toHaveBeenCalledTimes(1);
    expect(telemetry.recordAttempt).toHaveBeenCalledTimes(3);
    expect(telemetry.syncSession).toHaveBeenCalledTimes(3);
    expect(telemetry.completeSession).toHaveBeenCalledTimes(1);
    for (const call of vi.mocked(telemetry.recordAttempt).mock.calls) {
      expect(call[2].weekNumber).toBe(week1.number);
    }
  });

  it('ends the week on a capacity breach and unlocks nothing', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderWith(breachScenarios, telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Buy your way out of it'));

    // The fatal decision still gets its feedback: that is the teaching moment
    expect(screen.getByTestId('feedback-breach')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See what happened' }));

    expect(screen.getByTestId('breach-screen')).toBeInTheDocument();
    expect(screen.getByTestId('breach-day')).toHaveTextContent(
      `day 1 of ${week1.days}`
    );
    expect(screen.getByTestId('breach-cost')).toHaveTextContent(
      `B01 cost ${week1.startingCu + 10} CU. You had ${week1.startingCu}.`
    );
    // The second incident was never reached
    expect(screen.getByTestId('breach-remaining')).toHaveTextContent('1');
    expect(screen.getByTestId('breach-replay')).toHaveTextContent(
      `Run week ${week1.number} again`
    );
    await waitFor(() => {
      expect(telemetry.completeSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ cuRemaining: 0 }),
        'breached'
      );
    });

    // Nothing was cleared, so week 2 is still locked and the row says why
    await user.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByTestId(`week-${week2.number}`)).toBeDisabled();
    expect(screen.getByText(/Out of capacity once/)).toBeInTheDocument();
    expect(
      screen.getByText(`0/${WEEKS.length} weeks cleared`)
    ).toBeInTheDocument();
  });

  it('does not claim a week is unclear when an earlier run already cleared it', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderWith(breachScenarios, telemetry);

    // Clear week 1 properly, which unlocks week 2
    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Cancel the run and cap the pool'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Stagger the load'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('report-unlocked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByTestId(`week-${week2.number}`)).toBeEnabled();

    // Now replay week 1 and breach it
    await user.click(screen.getByTestId(`week-${week1.number}`));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Buy your way out of it'));
    await user.click(screen.getByRole('button', { name: 'See what happened' }));
    expect(screen.getByTestId('breach-screen')).toBeInTheDocument();

    // The earlier clear stands: a lost replay must not un-clear the week, and
    // the screen must not claim otherwise while the week list shows it done.
    expect(screen.getByTestId('breach-locked')).toHaveTextContent(
      `Week ${week1.number} was already cleared, so nothing is lost`
    );
    await user.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByTestId(`week-${week2.number}`)).toBeEnabled();
    expect(
      screen.getByText(`1/${WEEKS.length} weeks cleared`)
    ).toBeInTheDocument();
  });

  it('cannot walk out of a breach by reloading mid-feedback', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    const first = renderWith(breachScenarios, telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Buy your way out of it'));

    // Close the tab on the feedback panel, before the run has been recorded
    first.unmount();
    renderWith(breachScenarios, telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await user.click(screen.getByTestId('map-node-open'));
    // The breach came back with the save, so the week still ends here
    expect(screen.getByTestId('feedback-breach')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See what happened' }));
    expect(screen.getByTestId('breach-screen')).toBeInTheDocument();
  });

  it('resumes a week in progress after a reload', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    const first = renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await user.click(screen.getByTestId('map-node-open'));
    await user.click(screen.getByText('Share the gold lakehouse item only'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(telemetry.startSession).toHaveBeenCalledTimes(1);
    });

    // Simulate a reload: localStorage survives, the component remounts
    first.unmount();
    renderGame(telemetry);

    await waitFor(() => {
      expect(
        screen.getByText(`Resume week ${week1.number}`)
      ).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    expect(screen.getByTestId('status-sla')).toHaveTextContent(
      `SLA ${week1.startingSla + 5}`
    );
    expect(
      screen.getByRole('button', { name: /Open incident: The hardcoded connection/ })
    ).toBeInTheDocument();
    // The restored session is reused, not recreated
    expect(telemetry.startSession).toHaveBeenCalledTimes(1);
  });

  it('leads from the report into the week it just unlocked, on that week budget', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await playWeekOne(user);
    expect(screen.getByText('Week survived.')).toBeInTheDocument();

    await user.click(screen.getByTestId('report-next'));
    await waitFor(() => {
      expect(screen.getByTestId('map-node-open')).toBeInTheDocument();
    });
    // Week 2 runs on its own configured budget and day count, not week 1's
    expect(screen.getByTestId('status-week')).toHaveTextContent(
      `W${week2.number}`
    );
    expect(screen.getByTestId('status-cu')).toHaveTextContent(
      `CU ${week2.startingCu}`
    );
    expect(screen.getByTestId('status-day')).toHaveTextContent(
      `Day 1/${week2.days}`
    );
    // The map names the week being played
    expect(screen.getByText(week2.title)).toBeInTheDocument();
    expect(telemetry.startSession).toHaveBeenLastCalledWith(
      expect.stringContaining('guest-'),
      {
        weekNumber: week2.number,
        startingCu: week2.startingCu,
        startingSla: week2.startingSla,
        startingDay: 1,
      }
    );
  });

  it('unlocks the next week on the home screen and keeps the cleared one replayable', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await playWeekOne(user);
    await user.click(screen.getByRole('button', { name: 'Back to home' }));

    await waitFor(() => {
      expect(screen.getByTestId('week-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId(`week-${week2.number}`)).toBeEnabled();
    if (WEEKS[2]) {
      expect(screen.getByTestId(`week-${WEEKS[2].number}`)).toBeDisabled();
    }
    expect(
      screen.getByText(`1/${WEEKS.length} weeks cleared`)
    ).toBeInTheDocument();
    // Cleared week stays replayable, and shows the best result
    expect(screen.getByTestId(`week-${week1.number}`)).toBeEnabled();
    expect(screen.getByText(/Best 2\/2/)).toBeInTheDocument();
  });

  // Week 3 is the last week in the campaign, so it is the only one whose
  // report has nothing to unlock. Getting there means clearing 1 and 2 first,
  // which is exactly why this path is easy to leave untested.
  describe('the last week', () => {
    /** Clear weeks 1 and 2, ending on the week 2 report. */
    async function clearThroughWeekTwo(
      user: ReturnType<typeof userEvent.setup>
    ) {
      await waitFor(() => {
        expect(screen.getByTestId('start-week')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('start-week'));
      await playWeekOne(user);
      await user.click(screen.getByTestId('report-next'));
      await user.click(screen.getByTestId('map-node-open'));
      await user.click(screen.getByText('Size a custom Spark pool'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }

    it('opens after week 2, on its own budget', async () => {
      const telemetry = makeTelemetry();
      const user = userEvent.setup();
      renderGame(telemetry);
      await clearThroughWeekTwo(user);

      expect(screen.getByTestId('report-unlocked')).toHaveTextContent(
        `Week ${week3.number} unlocked: ${week3.title}`
      );
      await user.click(screen.getByTestId('report-next'));
      expect(screen.getByTestId('status-week')).toHaveTextContent(
        `W${week3.number}`
      );
      expect(screen.getByTestId('status-cu')).toHaveTextContent(
        `CU ${week3.startingCu}`
      );
      expect(telemetry.startSession).toHaveBeenLastCalledWith(
        expect.stringContaining('guest-'),
        {
          weekNumber: week3.number,
          startingCu: week3.startingCu,
          startingSla: week3.startingSla,
          startingDay: 1,
        }
      );
    });

    it('finishes the campaign with nothing left to unlock', async () => {
      const telemetry = makeTelemetry();
      const user = userEvent.setup();
      renderGame(telemetry);
      await clearThroughWeekTwo(user);
      await user.click(screen.getByTestId('report-next'));

      await user.click(screen.getByTestId('map-node-open'));
      await user.click(
        screen.getByText('Inventory both estates before touching either')
      );
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // No week after this one, so the report offers a replay instead
      expect(screen.queryByTestId('report-unlocked')).not.toBeInTheDocument();
      expect(screen.getByTestId('report-next')).toHaveTextContent(
        `Replay week ${week3.number}`
      );

      await user.click(screen.getByRole('button', { name: 'Back to home' }));
      expect(
        screen.getByText(`${WEEKS.length}/${WEEKS.length} weeks cleared`)
      ).toBeInTheDocument();
      for (const week of WEEKS) {
        expect(screen.getByTestId(`week-${week.number}`)).toBeEnabled();
      }
    });

    it('leaves the campaign unfinished when it breaches', async () => {
      const telemetry = makeTelemetry();
      const user = userEvent.setup();
      renderGame(telemetry);
      await clearThroughWeekTwo(user);
      await user.click(screen.getByTestId('report-next'));

      await user.click(screen.getByTestId('map-node-open'));
      await user.click(
        screen.getByText('Lift the whole estate onto your capacity tonight')
      );
      await user.click(screen.getByRole('button', { name: 'See what happened' }));

      expect(screen.getByTestId('breach-screen')).toBeInTheDocument();
      expect(screen.getByTestId('breach-cost')).toHaveTextContent(
        `W3S01 cost ${week3.startingCu + 10} CU. You had ${week3.startingCu}.`
      );
      // Never cleared, so this is the harsher of the two closing lines
      expect(screen.getByTestId('breach-locked')).toHaveTextContent(
        `Week ${week3.number} is not cleared. Nothing new opens up.`
      );

      await user.click(screen.getByRole('button', { name: 'Back to home' }));
      expect(
        screen.getByText(`2/${WEEKS.length} weeks cleared`)
      ).toBeInTheDocument();
      // Unlocked and replayable, but still not cleared
      expect(screen.getByTestId(`week-${week3.number}`)).toBeEnabled();
      expect(screen.getByText(/Out of capacity once/)).toBeInTheDocument();
    });
  });

  it('records a per-week best result and shows the curve on the stats tab', async () => {
    const telemetry = makeTelemetry();
    const user = userEvent.setup();
    renderGame(telemetry);

    await waitFor(() => {
      expect(screen.getByTestId('start-week')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('start-week'));
    await playWeekOne(user);
    await user.click(screen.getByRole('button', { name: 'Back to home' }));

    await user.click(screen.getByRole('button', { name: 'Stats' }));
    await waitFor(() => {
      expect(screen.getByTestId('week-curve')).toBeInTheDocument();
    });
    // A row per configured week, played ones with a percentage
    expect(screen.getByText(`1/${WEEKS.length} played`)).toBeInTheDocument();
    expect(
      screen.getByText(`W${week1.number} · ${week1.title}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`W${week2.number} · ${week2.title}`)
    ).toBeInTheDocument();
    expect(screen.getAllByText('not played').length).toBe(WEEKS.length - 1);
  });
});
