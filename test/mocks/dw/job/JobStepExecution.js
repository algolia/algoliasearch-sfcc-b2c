var JobStepExecution = function(){};

JobStepExecution.prototype.getID = function(){};
JobStepExecution.prototype.getJobExecution = function(){
    return {
        getJobID: function(){
            return 'algoliaContentIndex';
        }
    };
};
JobStepExecution.prototype.getParameterValue = function(){};
JobStepExecution.prototype.getStepID = function(){};
JobStepExecution.prototype.getStepTypeID = function(){};

module.exports = JobStepExecution;