// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {LabelRow, leftCol, rightCol} from 'src/components/admin_console_settings/common';
import manifest from 'src/manifest';
import {
    isCloud,
    isOnPremNotEnterprise,
    liveCaptionsEnabled,
    recordingsEnabled,
    transcriptionsEnabled,
} from 'src/selectors';
import {CustomComponentProps} from 'src/types/mattermost-webapp';

const LiveCaptionsLanguage = (props: CustomComponentProps) => {
    const {formatMessage} = useIntl();
    const restricted = useSelector(isOnPremNotEnterprise);
    const cloud = useSelector(isCloud);
    const recordingEnabled = useSelector(recordingsEnabled);
    const transcriptionEnabled = useSelector(transcriptionsEnabled);
    const liveCaptionEnabled = useSelector(liveCaptionsEnabled);

    if (cloud || restricted || !recordingEnabled || !transcriptionEnabled || !liveCaptionEnabled) {
        return null;
    }

    // Webapp doesn't pass the placeholder setting.
    const placeholder = manifest.settings_schema?.settings.find((e) => e.key === 'LiveCaptionsLanguage')?.placeholder || '';

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        props.onChange(props.id, e.target.value);
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
                        {formatMessage({defaultMessage: 'Live captions language'})}
                    </label>
                </LabelRow>
            </div>
            <div className={rightCol}>
                <input
                    data-testid={props.id + 'input'}
                    id={props.id}
                    className='form-control'
                    type={'input'}
                    placeholder={placeholder}
                    value={props.value}
                    onChange={handleChange}
                    disabled={props.disabled}
                />
                <div
                    data-testid={props.id + 'help-text'}
                    className='help-text'
                >
                    {formatMessage({defaultMessage: 'The language passed to the live captions transcriber. Should be a 2-letter ISO 639 Set 1 language code, e.g. \'en\'. If blank, will be set to English \'en\' as default.'})}
                </div>
            </div>
        </div>
    );
};

export default LiveCaptionsLanguage;
