// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TranscribeAPI} from '@mattermost/calls-common/lib/types';
import React, {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {LabelRow, leftCol, rightCol} from 'src/components/admin_console_settings/common';
import manifest from 'src/manifest';
import {isCloud, isOnPremNotEnterprise, recordingsEnabled, transcribeAPI, transcriptionsEnabled} from 'src/selectors';
import {CustomComponentProps} from 'src/types/mattermost-webapp';

const TranscriberNumThreads = (props: CustomComponentProps) => {
    const {formatMessage} = useIntl();
    const restricted = useSelector(isOnPremNotEnterprise);
    const cloud = useSelector(isCloud);
    const hasTranscriptions = useSelector(transcriptionsEnabled);
    const recordingEnabled = useSelector(recordingsEnabled);
    const api = useSelector(transcribeAPI);

    if (cloud || restricted || !hasTranscriptions || !recordingEnabled || api !== TranscribeAPI.WhisperCPP) {
        return null;
    }

    // Webapp doesn't pass the options
    const theDefault = manifest.settings_schema?.settings.find((e) => e.key === 'TranscriberNumThreads')?.default || '';

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        props.onChange(props.id, parseInt(e.target.value, 10));
    };

    return (
        <div
            data-testid={props.id}
            className='form-group'
        >
            <div className={'control-label ' + leftCol}>
                <LabelRow>
                    <label
                        data-testid={props.id + 'label'}
                        htmlFor={props.id}
                    >
                        {formatMessage({defaultMessage: 'Call transcriber threads'})}
                    </label>
                </LabelRow>
            </div>
            <div className={rightCol}>
                <input
                    data-testid={props.id + 'number'}
                    id={props.id}
                    className='form-control'
                    type={'number'}
                    placeholder={theDefault}
                    value={props.value}
                    onChange={handleChange}
                    disabled={props.disabled}
                />
                <div
                    data-testid={props.id + 'help-text'}
                    className='help-text'
                >
                    {formatMessage({defaultMessage: 'The number of threads used by the post-call transcriber. This must be in the range [1, numCPUs].'})}
                </div>
            </div>
        </div>
    );
};

export default TranscriberNumThreads;
